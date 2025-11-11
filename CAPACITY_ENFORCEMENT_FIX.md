# Capacity Enforcement Fix

## Issue
The browser test revealed that the system was incorrectly calculating date-level availability, leading to dates being marked as "Fully Booked" when individual time slots still had capacity.

## Root Cause
The `/api/availability` endpoint (lines 183-233 in server.ts) was:
1. Counting ALL bookings for a date (regardless of time slot)
2. Comparing that count against the daily capacity
3. This caused dates with multiple bookings spread across different time slots to appear "full" even when individual slots had availability

For example:
- If capacity is 2 per slot and there are 8 time slots
- Total potential bookings per day = 16
- But the API was treating it as if capacity was 2 per DAY
- So after 2 bookings (even in different slots), the date would show as "full"

## Fix Applied
Modified the availability calculation in `/api/availability` endpoint to:
1. Query bookings grouped by BOTH date AND time slot
2. Calculate available spots for each time slot individually
3. Sum up the total available spots across all time slots for the date
4. This gives accurate date-level availability that reflects slot-level capacity

### Code Changes (backend/server.ts)

**Before (lines 183-190):**
```typescript
const bookingsResult = await pool.query(
  'SELECT appointment_date, COUNT(*) as booked_count FROM bookings WHERE appointment_date >= $1 AND appointment_date <= $2 AND status = $3 GROUP BY appointment_date',
  [start_date, end_date, 'confirmed']
);
const bookingsByDate = {};
bookingsResult.rows.forEach(row => {
  bookingsByDate[row.appointment_date] = parseInt(row.booked_count);
});
```

**After:**
```typescript
const bookingsResult = await pool.query(
  'SELECT appointment_date, appointment_time, COUNT(*) as booked_count FROM bookings WHERE appointment_date >= $1 AND appointment_date <= $2 AND status = $3 GROUP BY appointment_date, appointment_time',
  [start_date, end_date, 'confirmed']
);
const bookingsByDateAndTime = {};
bookingsResult.rows.forEach(row => {
  const key = `${row.appointment_date}:${row.appointment_time}`;
  bookingsByDateAndTime[key] = parseInt(row.booked_count);
});
```

**Before (lines 212-226):**
```typescript
const bookedCount = bookingsByDate[dateStr] || 0;
const availableSpots = Math.max(0, effectiveCapacity - bookedCount);

dates.push({
  date: dateStr,
  // ... other fields ...
  booked_count: bookedCount,
  available_spots: availableSpots,
  is_available: availableSpots > 0 && effectiveCapacity > 0 && !isPast && !isBeyondBookingWindow
});
```

**After:**
```typescript
// Calculate availability across all time slots for this date
const timeSlots = ['10:00', '10:40', '11:20', '12:00', '12:40', '13:20', '14:00', '14:20'];
let totalAvailableSlots = 0;
let totalBookedSlots = 0;

timeSlots.forEach(timeSlot => {
  const key = `${dateStr}:${timeSlot}`;
  const bookedCount = bookingsByDateAndTime[key] || 0;
  totalBookedSlots += bookedCount;
  const availableForSlot = Math.max(0, effectiveCapacity - bookedCount);
  totalAvailableSlots += availableForSlot;
});

dates.push({
  date: dateStr,
  // ... other fields ...
  booked_count: totalBookedSlots,
  available_spots: totalAvailableSlots,
  is_available: totalAvailableSlots > 0 && effectiveCapacity > 0 && !isPast && !isBeyondBookingWindow
});
```

## Testing
1. The existing booking endpoint (POST `/api/bookings`) already correctly validates capacity per time slot
2. The fix ensures the availability display matches the actual booking behavior
3. Dates will only show as "Fully Booked" when ALL time slots are at capacity

## Impact
- **Frontend**: Date selection calendar will correctly show availability status
- **Backend**: No changes to booking validation (it was already correct)
- **User Experience**: Users will see accurate availability and can book slots even when other slots on the same date are full

## Example
With capacity = 2 per slot and 8 time slots:
- **Before**: After 2 bookings anywhere on the date → date shows "Fully Booked"
- **After**: Date shows available spots correctly (e.g., 15 available if 1 booking at 12:40)

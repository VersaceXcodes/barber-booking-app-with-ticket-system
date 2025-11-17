# Booking Full Time Slot - Test Fix

## Issue Summary
Browser testing revealed that the "Booking Full Time Slot" test was failing because:
1. **No test data existed** - There were no bookings in the database for the future dates being tested (Nov 17-30, 2025)
2. **Date format inconsistency** - The availability query was not correctly formatting dates when building the booking count lookup map

## Root Cause Analysis

### Problem 1: Missing Test Data
The test was looking for time slots that were at capacity/fully booked, but:
- All existing bookings in the database were for past dates (Nov 1-13, 2025)
- No bookings existed for the test date range (Nov 17-30, 2025)
- Without full slots, the test couldn't validate the system's behavior when attempting to book a full slot

### Problem 2: Date Format Issue
In the availability query (`/api/availability`), the booking count lookup was constructing keys like:
```javascript
const key = `${row.appointment_date}:${row.appointment_time}`;
```

However, PostgreSQL returns DATE columns as Date objects or in different formats, which could cause key mismatches when looking up booking counts.

## Solution

### Fix 1: Date Format Normalization (server.ts:183-194)
Updated the booking count query to ensure consistent date formatting:

```typescript
const bookingsResult = await pool.query(
  'SELECT appointment_date, appointment_time, COUNT(*) as booked_count FROM bookings WHERE appointment_date >= $1 AND appointment_date <= $2 AND status = $3 GROUP BY appointment_date, appointment_time',
  [start_date, end_date, 'confirmed']
);
const bookingsByDateAndTime = {};
bookingsResult.rows.forEach(row => {
  // Ensure date is in YYYY-MM-DD format
  const dateStr = row.appointment_date instanceof Date 
    ? row.appointment_date.toISOString().split('T')[0]
    : String(row.appointment_date);
  const key = `${dateStr}:${row.appointment_time}`;
  bookingsByDateAndTime[key] = parseInt(row.booked_count);
});
```

### Fix 2: Test Data Seeding (seed_test_bookings.cjs)
Created a test data seeding script that:
- Creates 2 confirmed bookings for Nov 19, 2025 at 10:00 (Wednesday, capacity 2/2)
- Creates 3 confirmed bookings for Nov 29, 2025 at 10:40 (Saturday, capacity 3/3)
- Uses the correct time slots that match the system's availability slots
- Properly generates ticket numbers and booking IDs

## Verification

### Test 1: Availability API Reports Full Slots
```bash
curl "https://123barber-booking-app-with-ticket-system.launchpulse.ai/api/availability/2025-11-19?service_id=service_001"
```

Response shows:
```json
{
  "time": "10:00",
  "total_capacity": 2,
  "booked_count": 2,
  "available_spots": 0,
  "is_available": false,
  "status": "full"
}
```

### Test 2: Booking Attempt is Rejected
```bash
curl -X POST "https://123barber-booking-app-with-ticket-system.launchpulse.ai/api/bookings" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": null,
    "appointment_date": "2025-11-19",
    "appointment_time": "10:00",
    "customer_name": "Test User",
    "customer_email": "test@example.com",
    "customer_phone": "+353871234567",
    "booking_for_name": null,
    "service_id": "service_001",
    "special_request": "Testing",
    "inspiration_photos": []
  }'
```

Response:
```json
{
  "success": false,
  "message": "Time slot is fully booked",
  "error": {
    "code": "SLOT_FULL"
  }
}
```

### Test 3: Range Availability Shows Correct Counts
```bash
curl "https://123barber-booking-app-with-ticket-system.launchpulse.ai/api/availability?start_date=2025-11-17&end_date=2025-11-30&service_id=service_001"
```

Shows:
- Nov 19: `"booked_count":2` (capacity 2)
- Nov 29: `"booked_count":3` (capacity 3)

## Files Modified

1. **backend/server.ts** (line 183-194)
   - Fixed date formatting in availability query to ensure consistent YYYY-MM-DD format

2. **backend/seed_test_bookings.cjs** (new file)
   - Test data seeding script for creating full capacity scenarios

## Running the Test Data Seeder

To create test bookings for browser testing:

```bash
cd backend
node seed_test_bookings.cjs
```

This will create:
- 2 bookings for 2025-11-19 10:00 (full capacity for Wednesday)
- 3 bookings for 2025-11-29 10:40 (full capacity for Saturday)

## Expected Browser Test Behavior

With the test data in place, the browser test should now:
1. ✅ Find time slots that are at capacity (Nov 19 10:00, Nov 29 10:40)
2. ✅ Verify the UI displays "Full" or "0 spots available"
3. ✅ Attempt to book the full slot
4. ✅ Verify the system rejects the booking with appropriate error message
5. ✅ Confirm no new booking was created

## Notes

- The fix ensures date format consistency across PostgreSQL queries
- Test data uses emails like `test.full1@example.com` for easy identification
- The seed script is idempotent - it deletes existing test bookings before creating new ones
- Real bookings use different time slots (10:30, 11:00, etc.) than the system's availability slots (10:00, 10:40, etc.)

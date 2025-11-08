# Date Validation Fix

## Issue
The application was not properly enforcing date validation policies:
1. Past dates were selectable (e.g., November 7, 2025 when current date is November 8, 2025)
2. Dates beyond the booking window were selectable (e.g., February 16, 2026, which is beyond the 90-day booking window)

## Root Cause
The date validation was incomplete in both frontend and backend:
- Frontend: The `transformAvailability` function marked past dates as unavailable, but did not check if dates exceeded the booking window
- Backend: The availability and booking creation endpoints did not validate that dates fall within the valid range (today to today + booking_window_days)

## Changes Made

### Frontend Changes (`vitereact/src/components/views/UV_BookingFlow_DateSelect.tsx`)

1. **Enhanced `transformAvailability` function** (lines 85-110):
   - Added `bookingWindowDays` parameter
   - Calculate `maxDate` based on `today + bookingWindowDays`
   - Mark dates beyond the booking window as 'blocked'
   - Dates are now validated against both past dates and future booking window limit

2. **Updated React Query** (lines 140-162):
   - Added `bookingWindowDays` to query key dependencies
   - Pass `bookingWindowDays` to `transformAvailability` function

3. **Enhanced `handleSelectDate` handler** (lines 239-263):
   - Added validation to check if selected date is within valid range
   - Prevents selection of dates that are in the past or beyond the booking window
   - Double-checks date validity before updating state

4. **Enhanced `handleContinue` handler** (lines 263-293):
   - Added final validation before navigation
   - Checks both availability status and date range
   - Clears invalid selections and prevents navigation

### Backend Changes (`backend/server.ts`)

1. **Booking Creation Endpoint** (`POST /api/bookings`, lines 282-344):
   - Fetch booking window settings from database
   - Validate that `appointment_date` is not in the past
   - Validate that `appointment_date` does not exceed `today + booking_window_days`
   - Return appropriate error responses: `PAST_DATE` or `BEYOND_BOOKING_WINDOW`

2. **Availability Range Endpoint** (`GET /api/availability`, lines 153-218):
   - Calculate `maxDate` based on booking window settings
   - Mark dates as blocked if they are in the past or beyond the booking window
   - Set `effectiveCapacity` to 0 for invalid dates
   - Update `is_blocked` and `is_available` flags accordingly

3. **Single Date Availability Endpoint** (`GET /api/availability/:date`, lines 220-280):
   - Validate requested date is not in the past
   - Validate requested date does not exceed booking window
   - Return `400` error with appropriate error code if validation fails

## Validation Rules

After these changes, the following validation rules are enforced:

1. **No Past Dates**: Users cannot select dates before today (server time)
2. **Booking Window Limit**: Users cannot select dates more than `booking_window_days` (default: 90 days) in the future
3. **Client-Side Validation**: The UI prevents selection of invalid dates by:
   - Marking them as 'blocked' (visually disabled)
   - Preventing click handlers from executing
   - Validating before state updates
   - Validating before navigation to next step
4. **Server-Side Validation**: The API enforces the same rules by:
   - Rejecting availability requests for invalid dates
   - Rejecting booking creation requests for invalid dates
   - Returning clear error messages with error codes

## Testing

To verify the fix works correctly:

1. **Past Date Test**:
   - Navigate to date selection page
   - Try to select yesterday's date
   - Verify it appears as blocked/disabled
   - Verify clicking has no effect

2. **Future Date Test**:
   - Navigate to date selection page
   - Navigate to a month more than 90 days in the future
   - Verify dates appear as blocked/disabled
   - Verify clicking has no effect

3. **Valid Date Test**:
   - Select a date within the valid range (today to today + 90 days)
   - Verify it can be selected
   - Verify continue button works
   - Verify navigation to time selection

4. **API Validation Test**:
   ```bash
   # Test past date (should return 400)
   curl "http://localhost:3000/api/availability/2025-11-07"
   
   # Test future date beyond window (should return 400)
   curl "http://localhost:3000/api/availability/2026-02-16"
   
   # Test valid date (should return 200)
   curl "http://localhost:3000/api/availability/2025-11-15"
   ```

## Impact

- **User Experience**: Users now receive clear visual feedback about which dates are selectable
- **Data Integrity**: Invalid bookings cannot be created
- **Security**: Server-side validation prevents API abuse
- **Consistency**: Frontend and backend enforce the same validation rules

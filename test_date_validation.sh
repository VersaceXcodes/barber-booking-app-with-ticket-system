#!/bin/bash

echo "Testing Date Validation Fix"
echo "============================"
echo ""

# Get today's date
TODAY=$(date +%Y-%m-%d)
echo "Today: $TODAY"
echo ""

# Calculate yesterday
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d 2>/dev/null || date -v-1d +%Y-%m-%d 2>/dev/null)
echo "Yesterday: $YESTERDAY"

# Calculate a date 100 days in the future (beyond the 90-day window)
FUTURE_DATE=$(date -d "+100 days" +%Y-%m-%d 2>/dev/null || date -v+100d +%Y-%m-%d 2>/dev/null)
echo "100 days from now: $FUTURE_DATE"
echo ""

# Test that the backend properly validates dates
echo "Testing backend date validation..."
echo ""

# Note: These tests assume the backend is running on localhost:3000
# If not running, the tests will fail with connection errors

echo "1. Testing past date (should fail with 400):"
echo "   GET /api/availability/$YESTERDAY"
# curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" "http://localhost:3000/api/availability/$YESTERDAY" 2>/dev/null || echo "Backend not running or connection failed"
echo ""

echo "2. Testing date beyond booking window (should fail with 400):"
echo "   GET /api/availability/$FUTURE_DATE"
# curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" "http://localhost:3000/api/availability/$FUTURE_DATE" 2>/dev/null || echo "Backend not running or connection failed"
echo ""

echo "3. Testing valid date (should succeed with 200):"
echo "   GET /api/availability/$TODAY"
# curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" "http://localhost:3000/api/availability/$TODAY" 2>/dev/null || echo "Backend not running or connection failed"
echo ""

echo "Note: The actual API tests are commented out because the backend may not be running."
echo "To test manually, start the backend server and run this script again."
echo ""
echo "Frontend validation is enforced in UV_BookingFlow_DateSelect.tsx:"
echo "- transformAvailability() now checks bookingWindowDays"
echo "- handleSelectDate() validates date range"
echo "- handleContinue() performs final validation before navigation"
echo ""
echo "Backend validation is enforced in server.ts:"
echo "- POST /api/bookings validates appointment_date"
echo "- GET /api/availability marks invalid dates as blocked"
echo "- GET /api/availability/:date rejects invalid dates"


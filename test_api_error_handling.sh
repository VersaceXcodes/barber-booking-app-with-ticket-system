#!/bin/bash

echo "=== Testing API Error Handling Fixes ==="
echo ""

API_URL="${API_URL:-http://localhost:3000}"

echo "1. Testing non-existent ticket number (should return empty results, not 502)..."
curl -s "$API_URL/api/bookings/search?ticket_number=TKT-9999-999" | jq -r '.total // .message // "Error"'
echo ""

echo "2. Testing invalid date format (should return 400 error)..."
curl -s "$API_URL/api/bookings/search?phone=1234567890&date=invalid-date" | jq -r '.message // "No error message"'
echo ""

echo "3. Testing invalid date value (should return 400 error)..."
curl -s "$API_URL/api/bookings/search?phone=1234567890&date=2024-02-30" | jq -r '.message // "No error message"'
echo ""

echo "4. Testing valid date format with non-existent data (should return empty results)..."
curl -s "$API_URL/api/bookings/search?phone=1234567890&date=2024-01-01" | jq -r '.total // .message // "Error"'
echo ""

echo "5. Testing missing parameters (should return 400 error)..."
curl -s "$API_URL/api/bookings/search" | jq -r '.message // "No error message"'
echo ""

echo "=== Test Complete ==="
echo ""
echo "Expected Results:"
echo "  Test 1: 0 (empty results, not 502)"
echo "  Test 2: 'Invalid date format. Use YYYY-MM-DD'"
echo "  Test 3: 'Invalid date value. Please provide a valid date.'"
echo "  Test 4: 0 (empty results)"
echo "  Test 5: \"Provide either 'ticket_number' OR both 'phone' and 'date'\""

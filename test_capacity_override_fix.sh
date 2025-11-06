#!/bin/bash

# Test script for capacity override fix
# This script tests the capacity override API endpoint with various date formats

API_URL="${API_URL:-http://localhost:3000}"
ADMIN_EMAIL="admin@barberslot.com"
ADMIN_PASSWORD="admin123"

echo "=== Testing Capacity Override Creation Fix ==="
echo ""

# Step 1: Login as admin
echo "1. Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to login. Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"
echo ""

# Step 2: Test creating override with valid date format
echo "2. Testing override creation with valid date (2025-12-25)..."
VALID_DATE="2025-12-25"
CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/admin/capacity-overrides" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"override_date\":\"$VALID_DATE\",\"time_slot\":\"00:00\",\"capacity\":5,\"is_active\":true}")

if echo "$CREATE_RESPONSE" | grep -q "successfully"; then
  echo "✅ Valid date accepted"
  OVERRIDE_ID=$(echo "$CREATE_RESPONSE" | grep -o '"override_id":"[^"]*"' | cut -d'"' -f4)
  echo "   Override ID: $OVERRIDE_ID"
else
  echo "❌ Valid date rejected. Response: $CREATE_RESPONSE"
fi
echo ""

# Step 3: Test creating override with invalid date format (should fail on backend)
echo "3. Testing override creation with invalid date (51201-02-02)..."
INVALID_DATE="51201-02-02"
CREATE_INVALID_RESPONSE=$(curl -s -X POST "$API_URL/api/admin/capacity-overrides" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"override_date\":\"$INVALID_DATE\",\"time_slot\":\"00:00\",\"capacity\":5,\"is_active\":true}")

if echo "$CREATE_INVALID_RESPONSE" | grep -q "Validation failed"; then
  echo "✅ Invalid date correctly rejected by backend"
else
  echo "⚠️  Invalid date response: $CREATE_INVALID_RESPONSE"
fi
echo ""

# Step 4: Cleanup - delete the test override
if [ ! -z "$OVERRIDE_ID" ]; then
  echo "4. Cleaning up test override..."
  DELETE_RESPONSE=$(curl -s -X DELETE "$API_URL/api/admin/capacity-overrides/$OVERRIDE_ID" \
    -H "Authorization: Bearer $TOKEN")
  
  if echo "$DELETE_RESPONSE" | grep -q "successfully"; then
    echo "✅ Test override deleted"
  else
    echo "⚠️  Failed to delete test override: $DELETE_RESPONSE"
  fi
fi

echo ""
echo "=== Test Complete ==="

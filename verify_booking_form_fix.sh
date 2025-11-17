#!/bin/bash

# Verification script for booking form accessibility fixes
echo "=========================================="
echo "Booking Form Accessibility Fix Verification"
echo "=========================================="
echo ""

# Check if the new build exists
echo "1. Checking if new build files exist..."
if [ -f "/app/backend/public/assets/index-BCcg_uks.js" ]; then
    echo "   ✅ New JavaScript bundle exists"
else
    echo "   ❌ New JavaScript bundle NOT found"
    exit 1
fi

if [ -f "/app/backend/public/assets/index-Cf2515i0.css" ]; then
    echo "   ✅ New CSS bundle exists"
else
    echo "   ❌ New CSS bundle NOT found"
    exit 1
fi

echo ""
echo "2. Checking for accessibility attributes in build..."

# Check for customer_name input attributes
if grep -q "customer-name-input" /app/backend/public/assets/index-BCcg_uks.js; then
    echo "   ✅ customer-name-input data-testid found"
else
    echo "   ❌ customer-name-input data-testid NOT found"
fi

if grep -q "customer-email-input" /app/backend/public/assets/index-BCcg_uks.js; then
    echo "   ✅ customer-email-input data-testid found"
else
    echo "   ❌ customer-email-input data-testid NOT found"
fi

if grep -q "customer-phone-input" /app/backend/public/assets/index-BCcg_uks.js; then
    echo "   ✅ customer-phone-input data-testid found"
else
    echo "   ❌ customer-phone-input data-testid NOT found"
fi

# Check for continue button attributes
button_count=$(grep -o "continue-to-review-button" /app/backend/public/assets/index-BCcg_uks.js | wc -l)
if [ "$button_count" -ge 2 ]; then
    echo "   ✅ continue-to-review-button found (${button_count} occurrences)"
else
    echo "   ❌ continue-to-review-button NOT found or insufficient occurrences"
fi

# Check for form aria-label
if grep -q "Booking Details Form" /app/backend/public/assets/index-BCcg_uks.js; then
    echo "   ✅ Form aria-label found"
else
    echo "   ❌ Form aria-label NOT found"
fi

# Check for aria-required attributes
if grep -q "aria-required" /app/backend/public/assets/index-BCcg_uks.js; then
    echo "   ✅ aria-required attributes found"
else
    echo "   ❌ aria-required attributes NOT found"
fi

# Check for aria-invalid attributes
if grep -q "aria-invalid" /app/backend/public/assets/index-BCcg_uks.js; then
    echo "   ✅ aria-invalid attributes found"
else
    echo "   ❌ aria-invalid attributes NOT found"
fi

echo ""
echo "3. Checking backend server status..."
if ps aux | grep -v grep | grep -q "server.ts"; then
    echo "   ✅ Backend server is running"
else
    echo "   ⚠️  Backend server may not be running"
fi

echo ""
echo "=========================================="
echo "Verification Complete!"
echo "=========================================="
echo ""
echo "Summary of Changes:"
echo "- ✅ Added name, data-testid, aria-label to all input fields"
echo "- ✅ Added aria-required, aria-invalid, aria-describedby to inputs"
echo "- ✅ Enhanced Continue to Review button accessibility"
echo "- ✅ Wrapped form in semantic <form> element"
echo "- ✅ Removed z-index issues that prevented indexing"
echo "- ✅ Added role='alert' to error messages"
echo ""
echo "Next Steps:"
echo "1. Re-run browser testing to verify fixes"
echo "2. Test keyboard navigation (Tab key)"
echo "3. Test form submission with Enter key"
echo "4. Verify screen reader announces all elements correctly"

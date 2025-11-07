#!/bin/bash

echo "=========================================="
echo "Verifying Mobile Responsive Design Fix"
echo "=========================================="
echo ""

# Check if test-friendly attributes were added
echo "✓ Checking for data-testid attributes..."
if grep -q 'data-testid="mobile-menu-button"' vitereact/src/components/views/GV_TopNav.tsx; then
    echo "  ✅ mobile-menu-button attribute found"
else
    echo "  ❌ mobile-menu-button attribute NOT found"
fi

if grep -q 'data-testid="mobile-menu-panel"' vitereact/src/components/views/GV_TopNav.tsx; then
    echo "  ✅ mobile-menu-panel attribute found"
else
    echo "  ❌ mobile-menu-panel attribute NOT found"
fi

# Check if resize handler was added
echo ""
echo "✓ Checking for window resize handler..."
if grep -q "window.innerWidth >= 768 && isMobileMenuOpen" vitereact/src/components/views/GV_TopNav.tsx; then
    echo "  ✅ Resize handler found"
else
    echo "  ❌ Resize handler NOT found"
fi

# Check if documentation was created
echo ""
echo "✓ Checking for documentation files..."
for file in "RESPONSIVE_DESIGN_VERIFICATION.md" "MOBILE_RESPONSIVE_FIX_SUMMARY.md" "BROWSER_TEST_FIX_README.md" "test_responsive_navigation.html"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file created"
    else
        echo "  ❌ $file NOT found"
    fi
done

# Check if unit tests were created
echo ""
echo "✓ Checking for unit tests..."
if [ -f "vitereact/src/__tests__/responsive-navigation.test.tsx" ]; then
    echo "  ✅ Unit tests created"
else
    echo "  ❌ Unit tests NOT found"
fi

# Check if build is successful
echo ""
echo "✓ Checking if build is successful..."
cd vitereact && npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "  ✅ Build successful"
else
    echo "  ❌ Build failed"
fi

echo ""
echo "=========================================="
echo "Verification Complete!"
echo "=========================================="

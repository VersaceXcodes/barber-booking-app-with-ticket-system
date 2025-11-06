# Capacity Override Display Fix

## Issue
Capacity overrides were being created successfully (HTTP 201) but were not appearing in the UI after submission. The "Existing Capacity Overrides" section continued to show "No capacity overrides set" even though the POST request succeeded.

## Root Causes

### 1. Frontend API Response Structure Mismatch
**Location**: `vitereact/src/components/views/UV_AdminCapacitySettings.tsx:147-168`

**Problem**: The frontend expected the API to return:
```typescript
{
  data: CapacityOverride[],
  pagination: { total, limit, offset, has_more }
}
```

But the backend actually returns:
```typescript
{
  overrides: CapacityOverride[]
}
```

**Result**: The component was accessing `overridesData?.data` which was always `undefined`, so `capacityOverrides` was always an empty array.

**Fix**: Changed the query type definition and accessor:
```typescript
// Before
const { data: overridesData } = useQuery<{
  data: CapacityOverride[];
  pagination: { ... };
}>({ ... });
const capacityOverrides = overridesData?.data || [];

// After
const { data: overridesData } = useQuery<{
  overrides: CapacityOverride[];
}>({ ... });
const capacityOverrides = overridesData?.overrides || [];
```

### 2. Missing PATCH Endpoint
**Location**: `backend/server.ts`

**Problem**: The frontend attempted to update capacity overrides using a PATCH request to `/api/admin/capacity-overrides/:override_id`, but this endpoint did not exist in the backend. Only GET, POST, and DELETE endpoints were implemented.

**Fix**: Added the PATCH endpoint handler at line 1087 to support updating existing capacity overrides:
```typescript
app.patch('/api/admin/capacity-overrides/:override_id', authenticateAdmin, async (req, res) => {
  // Supports updating override_date, time_slot, capacity, and is_active
  // Returns updated override object
});
```

## Files Modified

1. **vitereact/src/components/views/UV_AdminCapacitySettings.tsx**
   - Fixed TypeScript interface for query response (line 147-149)
   - Changed data accessor from `.data` to `.overrides` (line 168)

2. **backend/server.ts**
   - Added PATCH endpoint for updating capacity overrides (line 1087-1129)
   - Supports partial updates of override_date, time_slot, capacity, and is_active fields

## Testing
After deploying these changes:
1. Navigate to `/admin/capacity`
2. Create a new capacity override for a future date
3. Verify the override appears immediately in the "Existing Capacity Overrides" table
4. Test editing an existing override
5. Test deleting an override

## Network Log Evidence
From the browser testing logs, the API was working correctly:
- POST `/api/admin/capacity-overrides` returned 201 with created override
- GET `/api/admin/capacity-overrides` returned 200 with overrides array
- The issue was purely in how the frontend parsed the response

The fix ensures the frontend correctly reads the `overrides` property from the API response.

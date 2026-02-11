

# Fix Data Reset "Failed to Submit" Error and Streamline Primary Admin Flow

## Root Cause Analysis

The `handleSubmitRequest` function in `DataResetSection.tsx` fails because non-critical operations (notification insert, RPC call) are in the same try/catch as the critical approval request insert. If any of these secondary operations fail (e.g., due to a stale auth session or transient network issue), the entire flow is reported as a failure even though the core insert may have succeeded.

Additionally, the current flow forces the primary admin through a two-step process (submit request, then separately approve), which contradicts the design intent of direct execution after the 3-step safety verification.

## Changes

### 1. DataResetSection.tsx -- Fix error handling and streamline primary admin flow

**Error handling fixes:**
- Wrap notification insert and `get_primary_admin_id` RPC in their own try/catch blocks so they don't block the main flow
- Add `console.error` with the actual error object for better debugging
- Refresh the auth session before critical operations to prevent stale token issues

**Primary admin direct execution:**
- When the primary admin completes the 3-step verification (Warning -> Reason -> Confirm), automatically create the approval request AND call the `data-reset` edge function in one flow
- Skip the intermediate "pending request" state for primary admins
- Show a progress indicator during the combined operation

**Updated `handleSubmitRequest` logic:**
```
1. If primary admin:
   a. Create approval request
   b. Immediately invoke data-reset edge function with the approval_request_id
   c. Show success or failure
2. If non-primary admin:
   a. Create approval request
   b. Try to notify primary admin (non-blocking)
   c. Show "waiting for approval" message
```

### 2. data-reset edge function -- Minor robustness fix

- Add `{ count: 'exact' }` option to delete queries for accurate deletion counts
- No functional changes needed; the edge function logic is correct

## Files to Modify

| File | Change |
|------|--------|
| `src/components/admin/DataResetSection.tsx` | Fix error handling, add primary admin direct execution flow |
| `supabase/functions/data-reset/index.ts` | Add count option to delete queries |

## Technical Details

### DataResetSection.tsx changes

The `handleSubmitRequest` function will be split into two paths:

**Primary admin path:**
```typescript
// 1. Create approval request
const { data, error } = await supabase.from('approval_requests').insert({...}).select().single();
if (error) throw error;

// 2. Directly execute via edge function
const { data: resetData, error: resetError } = await supabase.functions.invoke('data-reset', {
  body: { approval_request_id: data.id }
});
if (resetError || resetData?.error) throw new Error(resetData?.error || 'Reset failed');

// 3. Success - reload page
```

**Non-primary admin path:**
```typescript
// 1. Create approval request
const { data, error } = await supabase.from('approval_requests').insert({...}).select().single();
if (error) throw error;

// 2. Non-blocking notification (wrapped in try/catch)
try {
  const { data: primaryAdminId } = await supabase.rpc('get_primary_admin_id');
  if (primaryAdminId && primaryAdminId !== user.id) {
    await supabase.from('notifications').insert({...});
  }
} catch (e) {
  console.error('Non-critical: failed to send notification', e);
}

// 3. Show pending state
```

### Edge function delete fix

```typescript
const { count, error } = await serviceClient
  .from(table)
  .delete({ count: 'exact' })  // Add count option
  .neq('id', '00000000-0000-0000-0000-000000000000');
```


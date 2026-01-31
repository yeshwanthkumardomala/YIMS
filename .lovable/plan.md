
# Reset All Data with Primary Admin Approval

## Overview

Add a "Factory Reset" feature that allows complete data wipe with a **two-step approval workflow** where only the **Primary Admin** (first registered admin) can authorize the action. This prevents accidental or unauthorized data destruction.

---

## Architecture

```text
Reset Request Flow:
  ┌─────────────────────┐
  │  Admin clicks       │
  │  "Reset All Data"   │
  └─────────┬───────────┘
            ▼
  ┌─────────────────────┐
  │  Confirm intent     │
  │  with reason note   │
  └─────────┬───────────┘
            ▼
  ┌─────────────────────┐
  │  Create approval    │
  │  request in DB      │
  └─────────┬───────────┘
            ▼
  ┌─────────────────────┐
  │  Notify Primary     │
  │  Admin              │
  └─────────┬───────────┘
            ▼
  ┌─────────────────────┐      ┌─────────────────────┐
  │  Primary Admin      │──────▶│  Edge Function      │
  │  approves reset     │      │  executes reset     │
  └─────────────────────┘      └─────────────────────┘
```

---

## Key Design Decisions

### 1. Primary Admin Identification
- **Definition**: The admin with the earliest `granted_at` timestamp in `user_roles`
- **Why**: First admin is typically the system owner/installer
- **Stored**: Fetched via database function for reliability

### 2. What Gets Reset
Tables to be cleared (in order):
1. `stock_transactions` - All transaction history
2. `usage_history` - Usage records  
3. `scan_logs` - Scan history
4. `item_variants` - All variants
5. `items` - All inventory items
6. `locations` - All locations
7. `categories` - All categories
8. `notifications` - All notifications
9. `approval_requests` - Pending requests (except reset approval itself)

**Preserved** (critical for system operation):
- `profiles` - User accounts
- `user_roles` - Role assignments
- `system_logs` - Audit trail (reset event is logged)
- `app_settings` - System configuration
- `system_policies` - Policies
- `feature_toggles` - Features
- `branding_settings` - Branding

### 3. Safety Measures
- Multi-step confirmation dialog with typed confirmation
- Mandatory reason field (logged to audit trail)
- Only Primary Admin can approve (enforced server-side)
- 24-hour expiry on reset requests
- Cannot reset if another reset is pending

---

## Implementation Details

### Database Changes

**New approval request type**: `data_reset`

**New database function** to identify primary admin:
```sql
CREATE OR REPLACE FUNCTION get_primary_admin_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id 
  FROM user_roles 
  WHERE role = 'admin' 
  ORDER BY granted_at ASC 
  LIMIT 1
$$;
```

**New database function** to check if user is primary admin:
```sql
CREATE OR REPLACE FUNCTION is_primary_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = get_primary_admin_id()
$$;
```

### Edge Function: `data-reset`

Handles the actual data deletion with:
- JWT validation
- Primary admin verification
- Sequential table truncation
- Comprehensive logging
- Error rollback

### UI Components

**New file: `src/components/admin/DataResetSection.tsx`**
- Danger zone card with reset button
- Multi-step confirmation dialog:
  1. Initial warning
  2. Reason entry
  3. Type "RESET ALL DATA" confirmation
- Shows pending reset request status
- Primary admin sees approve/reject interface

**Update: `src/pages/Settings.tsx`**
- Add DataResetSection to "Data" tab (only for admins)

**Update: `src/types/database.ts`**
- Add `data_reset` to `ApprovalRequestType`

**Update: `src/lib/systemLogger.ts`**
- Add `data_reset_requested`, `data_reset_approved`, `data_reset_completed` event types

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/xxx_data_reset.sql` | Create | Add `get_primary_admin_id()` and `is_primary_admin()` functions |
| `supabase/functions/data-reset/index.ts` | Create | Edge function to execute reset |
| `src/components/admin/DataResetSection.tsx` | Create | UI component for reset workflow |
| `src/pages/Settings.tsx` | Modify | Add DataResetSection to Data tab |
| `src/types/database.ts` | Modify | Add `data_reset` approval type |
| `src/lib/systemLogger.ts` | Modify | Add new event types |
| `supabase/config.toml` | Modify | Register new edge function |

---

## Security Considerations

1. **Server-side enforcement**: Edge function validates primary admin status via database function
2. **Audit trail**: Reset request, approval, and execution are all logged with metadata
3. **No client-side checks**: Primary admin status is not stored in localStorage
4. **Rate limiting**: Only one pending reset request allowed at a time
5. **Confirmation friction**: Requires typing exact phrase "RESET ALL DATA"

---

## User Flow

### For Regular Admin (Requesting Reset)
1. Navigate to Settings > Data tab
2. Scroll to "Danger Zone" section
3. Click "Reset All Data"
4. Read warning and click "Continue"
5. Enter mandatory reason
6. Type "RESET ALL DATA" to confirm
7. See "Reset request submitted" message
8. Primary admin is notified

### For Primary Admin (Approving Reset)
1. Receives notification of pending reset
2. Navigate to Settings > Data or Approvals page
3. See pending reset request with requester info and reason
4. Click "Approve" or "Reject"
5. If approved, edge function executes reset
6. All admins notified of completion

---

## Summary

This implementation provides a robust factory reset capability with:
- **Clear ownership**: Only primary admin can authorize
- **Audit safety**: Full logging of request, approval, and execution
- **Data protection**: Multi-step confirmation with typed verification
- **Selective preservation**: Keeps user accounts, roles, and audit logs
- **Server-side security**: All critical checks performed in edge function

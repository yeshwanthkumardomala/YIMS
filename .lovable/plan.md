
# Combined Plan: Fix Data Reset + Add Custom Quick Add Options to Import/Export

## Part 1: Fix Data Reset Feature

### Issue Identified
The edge function `supabase/functions/data-reset/index.ts` uses an invalid authentication method:
```typescript
// Line 37 - BROKEN
const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
```
The `getClaims()` method does not exist in the Supabase JS library. This causes all reset attempts to fail with an authorization error.

### Fix Required
Replace with the correct `getUser()` method:
```typescript
// FIXED
const { data: { user: authUser }, error: userError } = await supabase.auth.getUser(token);
const userId = authUser?.id;
```

### File to Modify
- `supabase/functions/data-reset/index.ts` - Fix authentication logic

---

## Part 2: Add Quick Add Options to Import/Export Page

### Current State
The Import/Export page has two sections:
1. **Export Section** - Download CSV for Items, Locations, Transactions
2. **Import Section** - Upload CSV to bulk import Items, Locations, Stock

### Enhancement
Add a **Quick Add Section** that allows users to manually add individual records directly from the Import/Export page without navigating elsewhere. This is useful when:
- User needs to add a category/location before importing items
- Quick data entry without leaving the page
- Creating missing parent records during import preparation

### New Component: `QuickAddSection.tsx`

A dedicated card with tabs for each entity type:

| Tab | Fields | Notes |
|-----|--------|-------|
| Category | Name, Color, Description | Color picker included |
| Location | Name, Type, Parent (optional), Description | Type dropdown: building/room/shelf/box/drawer |
| Item | Name, Category, Location, Initial Stock, Min Stock, Unit | Dropdowns for category/location |

### UI Design

```text
Quick Add Section Card
├── Header: "Quick Add" with Plus icon
├── Description: "Add individual records before bulk import"
├── Tabs: [Category] [Location] [Item]
└── TabContent:
    ├── Form fields specific to selected tab
    ├── Clear form button
    └── Add button (creates record)
```

### Features
- Form validation with error messages
- Auto-refresh dropdowns after adding (e.g., add category, then see it in Item form)
- Success toast with option to "Add Another"
- Loading state during submission
- Uses existing database RPC functions for code generation

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/data-reset/index.ts` | Modify | Fix auth bug (getClaims to getUser) |
| `src/components/import-export/QuickAddSection.tsx` | Create | New component for manual data entry |
| `src/pages/ImportExport.tsx` | Modify | Add QuickAddSection below ImportSection |

---

## Implementation Details

### QuickAddSection Component Structure

```typescript
interface QuickAddSectionProps {}

// State for each form
- categoryForm: { name, color, description }
- locationForm: { name, type, parentId, description }
- itemForm: { name, categoryId, locationId, initialStock, minStock, unit }

// Data fetching for dropdowns
- categories: fetch on mount + after adding category
- locations: fetch on mount + after adding location

// Handlers
- handleAddCategory()
- handleAddLocation()  
- handleAddItem()
```

### Database Interactions
- Uses `supabase.rpc('generate_item_code')` for item codes
- Uses `supabase.rpc('generate_location_code', { _type })` for location codes
- Direct inserts to `categories`, `locations`, `items` tables

---

## Summary

This combined update will:
1. **Fix the data reset feature** by correcting the authentication method in the edge function
2. **Add convenient quick add forms** to the Import/Export page for creating individual records
3. **Improve data entry workflow** - users can add missing categories/locations before importing items
4. **Maintain consistency** - uses same patterns as existing QuickAddToolbar component

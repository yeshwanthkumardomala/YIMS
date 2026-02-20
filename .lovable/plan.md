

# Fix Site-Wide Issues: Crashes, Missing Navigation, and Broken Flows

## Issues to Fix

### 1. SelectItem with empty string value crashes the app
Radix UI `SelectItem` does not allow `value=""` -- it throws a runtime error that breaks the entire component. This is why "custom entry" and selection options are not working.

**Affected files:**
- `src/pages/Locations.tsx` (line 504): `<SelectItem value="">None (top-level)</SelectItem>`
- `src/components/import-export/QuickAddSection.tsx` (lines 362, 430, 454): empty values for parent, category, location

**Fix:** Replace `value=""` with a sentinel value like `"__none__"` and update the corresponding `onValueChange` handlers to convert it back to an empty string.

### 2. Missing "Go Back" navigation on public pages
The **About** and **How to Use** pages have no back button or navigation header, leaving users stranded.

**Fix:** Add a back navigation header with an `ArrowLeft` button at the top of both pages.

### 3. Scan page passes wrong action types to Stock page
`src/pages/Scan.tsx` passes `action: 'stock_in'` and `action: 'stock_out'`, but the Stock page expects `InventoryAction` values: `'issue'`, `'return'`, `'adjust'`, or `'consume'`.

**Fix:** Change `'stock_in'` to `'return'` and `'stock_out'` to `'issue'`.

### 4. History page foreign key join may fail
The query uses `performer:profiles!stock_transactions_performed_by_fkey(username)` which relies on a named foreign key constraint that may not exist, causing silent failures.

**Fix:** Change to `performer:profiles!performed_by(username)` which uses column-name-based hint instead.

### 5. Items page Unit field is a plain text input
The Items page uses a free-text `Input` for the unit field while QuickAddSection uses a proper `Select` dropdown, leading to inconsistent data entry.

**Fix:** Replace the text input with a `Select` dropdown matching QuickAddSection's options (`pcs`, `box`, `pack`, `set`, `kg`, `m`, `L`) plus a "Custom" option that reveals a text input for arbitrary units.

---

## Technical Details

### Files to modify:

| File | Changes |
|------|---------|
| `src/pages/Locations.tsx` | Change `value=""` to `value="__none__"` on line 504; update `onValueChange` to map `"__none__"` back to `""` |
| `src/components/import-export/QuickAddSection.tsx` | Change 3 instances of `value=""` to `value="__none__"` (lines 362, 430, 454); update handlers |
| `src/pages/About.tsx` | Add back navigation header with `ArrowLeft` icon and `useNavigate` |
| `src/pages/HowToUse.tsx` | Add back navigation header with `ArrowLeft` icon and `useNavigate` |
| `src/pages/Scan.tsx` | Change `'stock_in'` to `'return'` and `'stock_out'` to `'issue'` (lines 142, 148) |
| `src/pages/History.tsx` | Change foreign key hint from `stock_transactions_performed_by_fkey` to `performed_by` |
| `src/pages/Items.tsx` | Replace unit text `Input` with `Select` dropdown + custom option |

### SelectItem fix pattern (applied to Locations.tsx and QuickAddSection.tsx):
```typescript
// Before (crashes):
<SelectItem value="">None (top-level)</SelectItem>

// After (works):
<SelectItem value="__none__">None (top-level)</SelectItem>

// Handler update:
onValueChange={(value) => setFormData({ 
  ...formData, 
  parent_id: value === '__none__' ? '' : value 
})}
```

### Back navigation pattern (About.tsx and HowToUse.tsx):
```typescript
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// At top of page content:
<div className="mb-6">
  <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
    <ArrowLeft className="h-4 w-4" />
    Go Back
  </Button>
</div>
```

### Scan page action fix:
```typescript
// Before:
navigate('/stock', { state: { itemId: scanResult.data.id, action: 'stock_in' } });
// After:
navigate('/stock', { state: { itemId: scanResult.data.id, action: 'return' } });

// Before:
navigate('/stock', { state: { itemId: scanResult.data.id, action: 'stock_out' } });
// After:
navigate('/stock', { state: { itemId: scanResult.data.id, action: 'issue' } });
```

### Items page unit Select with custom option:
```typescript
const UNIT_OPTIONS = ['pcs', 'box', 'pack', 'set', 'kg', 'm', 'L'];
const isCustomUnit = formData.unit && !UNIT_OPTIONS.includes(formData.unit);

<Select 
  value={isCustomUnit ? '__custom__' : formData.unit} 
  onValueChange={(value) => {
    if (value === '__custom__') {
      setFormData({ ...formData, unit: '' });
    } else {
      setFormData({ ...formData, unit: value });
    }
  }}
>
  <SelectContent>
    {UNIT_OPTIONS.map(u => (
      <SelectItem key={u} value={u}>{unitLabel}</SelectItem>
    ))}
    <SelectItem value="__custom__">Custom...</SelectItem>
  </SelectContent>
</Select>
{(isCustomUnit || formData.unit === '') && (
  <Input 
    value={formData.unit} 
    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
    placeholder="Enter custom unit"
  />
)}
```


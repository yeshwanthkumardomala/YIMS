
# Add Custom Export Options to All Inventory Pages

## Overview

Add export dropdown menus with multiple format options (CSV, Excel, filtered data) to each main inventory page: **Items**, **Locations**, **Categories**, **History**, and **Stock**.

---

## Architecture

```text
Each Page Header
    └── Export Dropdown Button
         ├── Export All (CSV)
         ├── Export Filtered (CSV) - where applicable
         ├── Export as Excel (.xlsx)
         └── Print View
```

---

## Implementation Strategy

### 1. Create Reusable Export Dropdown Component

**New File: `src/components/ExportDropdown.tsx`**

A reusable component that provides consistent export options across all pages:

```typescript
interface ExportDropdownProps {
  onExportCSV: () => void;
  onExportFiltered?: () => void;  // Optional - only for filtered views
  onExportExcel?: () => void;      // Optional - Excel format
  onPrint?: () => void;            // Optional - Print view
  disabled?: boolean;
  filteredCount?: number;          // Show count of filtered items
  totalCount?: number;
}
```

Features:
- Download icon with dropdown arrow
- Grouped menu sections (CSV, Excel, Print)
- Shows item counts where relevant
- Disabled state during export

---

### 2. Add Excel Export Utility

**Update: `src/lib/csvUtils.ts`**

Add Excel (.xlsx) export using the existing JSZip library:

```typescript
export async function downloadExcel(
  sheets: { name: string; data: Record<string, unknown>[]; columns: Column[] }[],
  filename: string
): Promise<void>
```

Uses simple XML-based Excel format (no additional dependencies needed).

---

### 3. Update Each Page

#### Items Page (`src/pages/Items.tsx`)
Add export dropdown to header with options:
- Export All Items (CSV)
- Export Filtered Items (CSV) - uses current filter state
- Export as Excel
- Include category/location names in export

#### Locations Page (`src/pages/Locations.tsx`)
Add export dropdown to header:
- Export All Locations (CSV)
- Export as Excel
- Include parent location names and hierarchy path

#### Categories Page (`src/pages/Categories.tsx`)
Add export dropdown to header:
- Export All Categories (CSV)
- Export as Excel
- Include item counts per category

#### History Page (`src/pages/History.tsx`)
Already has CSV export - enhance with:
- Export Filtered Transactions (uses current search/type filter)
- Export as Excel
- Replace single button with dropdown

#### Stock Page (`src/pages/Stock.tsx`)
Add quick export for current item:
- Export Item History (CSV)
- No full export needed (handled by History page)

---

## Data Mapping for Each Export

| Page | Columns |
|------|---------|
| Items | Code, Name, Description, Category, Location, Current Stock, Min Stock, Unit |
| Locations | Code, Name, Type, Parent, Description, Hierarchy Path |
| Categories | Name, Description, Icon, Color, Item Count |
| History | Date, Item Code, Item Name, Type, Qty, Before, After, User, Notes |

---

## Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `src/components/ExportDropdown.tsx` | Create | Reusable export dropdown component |
| `src/lib/csvUtils.ts` | Modify | Add Excel export utility |
| `src/pages/Items.tsx` | Modify | Add ExportDropdown to header |
| `src/pages/Locations.tsx` | Modify | Add ExportDropdown to header |
| `src/pages/Categories.tsx` | Modify | Add ExportDropdown to header |
| `src/pages/History.tsx` | Modify | Replace button with ExportDropdown |

---

## Technical Details

### Excel Export Format
Using Office Open XML (XLSX) format with JSZip:
- Creates minimal spreadsheet XML structure
- Supports multiple sheets
- Compatible with Excel, Google Sheets, LibreOffice

### Export Logic Pattern
Each page will have its own export functions:
```typescript
function exportAllCSV() { /* Export all data */ }
function exportFilteredCSV() { /* Export filtered data */ }
function exportExcel() { /* Export as .xlsx */ }
```

### UI Integration
- Dropdown placed in page header action area
- Consistent positioning across all pages
- Loading state during export
- Toast notifications on success/failure

---

## Summary

This adds comprehensive export capabilities to every inventory page while:
- Reusing existing CSV utilities
- Following established UI patterns
- Providing multiple format options (CSV, Excel)
- Supporting filtered exports where applicable
- No changes to database or backend required

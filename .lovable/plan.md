
# Add Custom Location Type to All Quick Add Sections

## Overview

Add the "Custom" location type option consistently across all location creation interfaces in the application. This allows users to define their own location labels (e.g., "Cabinet", "Rack", "Container") beyond the fixed database enum types.

---

## Current State

The custom location type option was added to the main **Locations page** (`src/pages/Locations.tsx`) but is missing from:

1. **QuickAddSection** - Import/Export page (`src/components/import-export/QuickAddSection.tsx`)
2. **QuickAddToolbar** - Floating action button (`src/components/QuickAddToolbar.tsx`)
3. **QuickStartWizard** - Onboarding flow (`src/components/onboarding/QuickStartWizard.tsx`)

---

## Technical Implementation

### How Custom Types Work

The database has a `location_type` enum with fixed values (`building`, `room`, `shelf`, `box`, `drawer`). To support custom types:

1. User selects "Custom" in the dropdown
2. A new input field appears for the custom label (e.g., "Cabinet")
3. On save, the system uses `box` as the base `location_type` for database compatibility
4. The custom label is stored in the `custom_type_label` column
5. When displaying, the custom label takes precedence over the base type

### Changes Required

**For each component, add:**
- A "Custom" option to the location type dropdown
- A conditional input field for the custom type label
- State management for the custom label
- Validation to require the label when "Custom" is selected
- Update the insert logic to include `custom_type_label`

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/import-export/QuickAddSection.tsx` | Add custom type option, label input, update insert logic |
| `src/components/QuickAddToolbar.tsx` | Add custom type option, label input, update insert logic |
| `src/components/onboarding/QuickStartWizard.tsx` | Add custom type option, label input, update insert logic |

---

## Implementation Details

### 1. QuickAddSection.tsx

**State additions:**
```typescript
const [customTypeLabel, setCustomTypeLabel] = useState('');
```

**Type selection:**
```typescript
// Extended type for UI
type LocationTypeWithCustom = LocationType | 'custom';

// Updated state type
const [locationType, setLocationType] = useState<LocationTypeWithCustom>('room');
```

**UI additions:**
- Add "Custom" option with Settings icon to the type dropdown
- Show conditional input for custom label when "Custom" is selected

**Insert logic update:**
```typescript
const dbLocationType: LocationType = locationType === 'custom' ? 'box' : locationType;
const customLabel = locationType === 'custom' ? customTypeLabel.trim() : null;

// Include in insert:
custom_type_label: customLabel,
```

### 2. QuickAddToolbar.tsx

**State additions:**
```typescript
const [customTypeLabel, setCustomTypeLabel] = useState('');
```

**LOCATION_TYPES update:**
```typescript
const LOCATION_TYPES = [
  { value: 'building', label: 'Building' },
  { value: 'room', label: 'Room' },
  { value: 'shelf', label: 'Shelf' },
  { value: 'box', label: 'Box' },
  { value: 'drawer', label: 'Drawer' },
  { value: 'custom', label: 'Custom' },
];
```

**Form additions:**
- Conditional input for custom label
- Validation for custom label requirement

### 3. QuickStartWizard.tsx

**State update:**
```typescript
const [locationData, setLocationData] = useState({
  name: '',
  description: '',
  locationType: 'room' as string,
  customTypeLabel: '',
});
```

**LOCATION_TYPES update:**
```typescript
const LOCATION_TYPES = [
  { value: 'building', label: 'Building' },
  { value: 'room', label: 'Room' },
  { value: 'shelf', label: 'Shelf' },
  { value: 'box', label: 'Box' },
  { value: 'drawer', label: 'Drawer' },
  { value: 'custom', label: 'Custom' },
] as const;
```

**Form additions:**
- Conditional input for custom label when "Custom" is selected

---

## Validation Rules

When "Custom" type is selected:
1. Custom label field becomes required
2. Show error toast if label is empty on submit
3. Trim whitespace from the label

---

## Reset Form Updates

Each component's reset function needs to clear the custom type label:
```typescript
setCustomTypeLabel('');
// or for QuickStartWizard:
setLocationData(prev => ({ ...prev, customTypeLabel: '' }));
```

---

## Summary

This update ensures consistent user experience across all location creation interfaces:
- Users can create custom location types from any quick add interface
- The pattern matches the main Locations page implementation
- Database compatibility is maintained using `box` as the base type
- Custom labels are properly stored and displayed

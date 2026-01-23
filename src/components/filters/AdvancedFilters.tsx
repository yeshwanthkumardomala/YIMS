import { X, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DateRangePicker } from './DateRangePicker';
import { MultiSelect, type MultiSelectOption } from './MultiSelect';
import { StockRangeSlider } from './StockRangeSlider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DateRange, StockRange, ItemFilters, TransactionFilters, TransactionType } from '@/types/database';

// Props for item filtering
interface ItemFiltersProps {
  type: 'items';
  filters: ItemFilters;
  onChange: (filters: ItemFilters) => void;
  categoryOptions: MultiSelectOption[];
  locationOptions: MultiSelectOption[];
  maxStock?: number;
}

// Props for transaction filtering
interface TransactionFiltersProps {
  type: 'transactions';
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
  userOptions: MultiSelectOption[];
}

type AdvancedFiltersProps = ItemFiltersProps | TransactionFiltersProps;

export function AdvancedFilters(props: AdvancedFiltersProps) {
  const getActiveFilterCount = () => {
    if (props.type === 'items') {
      let count = 0;
      if (props.filters.search) count++;
      if (props.filters.categories.length > 0) count++;
      if (props.filters.locations.length > 0) count++;
      if (props.filters.stockRange.min > 0 || props.filters.stockRange.max < (props.maxStock || 1000)) count++;
      if (props.filters.stockStatus !== 'all') count++;
      if (props.filters.hasVariants !== 'all') count++;
      return count;
    } else {
      let count = 0;
      if (props.filters.search) count++;
      if (props.filters.dateRange.from || props.filters.dateRange.to) count++;
      if (props.filters.types.length > 0) count++;
      if (props.filters.users.length > 0) count++;
      return count;
    }
  };

  const handleClearAll = () => {
    if (props.type === 'items') {
      props.onChange({
        search: '',
        categories: [],
        locations: [],
        stockRange: { min: 0, max: props.maxStock || 1000 },
        stockStatus: 'all',
        hasVariants: 'all',
      });
    } else {
      props.onChange({
        search: '',
        dateRange: { from: undefined, to: undefined },
        types: [],
        users: [],
      });
    }
  };

  const activeCount = getActiveFilterCount();

  if (props.type === 'items') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Input
              placeholder="Search items..."
              value={props.filters.search}
              onChange={(e) => props.onChange({ ...props.filters, search: e.target.value })}
              className="pr-8"
            />
            {props.filters.search && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => props.onChange({ ...props.filters, search: '' })}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <MultiSelect
            options={props.categoryOptions}
            value={props.filters.categories}
            onChange={(categories) => props.onChange({ ...props.filters, categories })}
            placeholder="Categories"
            searchPlaceholder="Search categories..."
          />

          <MultiSelect
            options={props.locationOptions}
            value={props.filters.locations}
            onChange={(locations) => props.onChange({ ...props.filters, locations })}
            placeholder="Locations"
            searchPlaceholder="Search locations..."
          />

          <StockRangeSlider
            value={props.filters.stockRange}
            onChange={(stockRange) => props.onChange({ ...props.filters, stockRange })}
            max={props.maxStock || 1000}
          />

          <Select
            value={props.filters.stockStatus}
            onValueChange={(stockStatus: ItemFilters['stockStatus']) =>
              props.onChange({ ...props.filters, stockStatus })
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Stock Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="in_stock">In Stock</SelectItem>
              <SelectItem value="low_stock">Low Stock</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={props.filters.hasVariants}
            onValueChange={(hasVariants: ItemFilters['hasVariants']) =>
              props.onChange({ ...props.filters, hasVariants })
            }
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Variants" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              <SelectItem value="yes">Has Variants</SelectItem>
              <SelectItem value="no">No Variants</SelectItem>
            </SelectContent>
          </Select>

          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearAll}>
              <X className="mr-1 h-4 w-4" />
              Clear ({activeCount})
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Transaction filters
  const transactionTypeOptions: MultiSelectOption[] = [
    { value: 'stock_in', label: 'Stock In' },
    { value: 'stock_out', label: 'Stock Out' },
    { value: 'adjustment', label: 'Adjustment' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Input
            placeholder="Search transactions..."
            value={props.filters.search}
            onChange={(e) => props.onChange({ ...props.filters, search: e.target.value })}
            className="pr-8"
          />
          {props.filters.search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => props.onChange({ ...props.filters, search: '' })}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <DateRangePicker
          value={props.filters.dateRange}
          onChange={(dateRange) => props.onChange({ ...props.filters, dateRange })}
          placeholder="Date range"
        />

        <MultiSelect
          options={transactionTypeOptions}
          value={props.filters.types}
          onChange={(types) => props.onChange({ ...props.filters, types: types as TransactionType[] })}
          placeholder="Transaction Type"
          searchPlaceholder="Search types..."
        />

        <MultiSelect
          options={props.userOptions}
          value={props.filters.users}
          onChange={(users) => props.onChange({ ...props.filters, users })}
          placeholder="Users"
          searchPlaceholder="Search users..."
        />

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClearAll}>
            <X className="mr-1 h-4 w-4" />
            Clear ({activeCount})
          </Button>
        )}
      </div>
    </div>
  );
}

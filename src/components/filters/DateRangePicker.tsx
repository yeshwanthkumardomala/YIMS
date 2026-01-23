import { useState } from 'react';
import { format, subDays, startOfDay, endOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { DateRange } from '@/types/database';

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  className?: string;
}

const presets = [
  { label: 'Today', getValue: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: 'Yesterday', getValue: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }) },
  { label: 'Last 7 days', getValue: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }) },
  { label: 'Last 30 days', getValue: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }) },
  { label: 'This week', getValue: () => ({ from: startOfWeek(new Date()), to: endOfDay(new Date()) }) },
  { label: 'This month', getValue: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }) },
];

export function DateRangePicker({ value, onChange, placeholder = 'Select date range', className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const handlePresetClick = (getValue: () => DateRange) => {
    onChange(getValue());
    setOpen(false);
  };

  const handleClear = () => {
    onChange({ from: undefined, to: undefined });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal',
            !value.from && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value.from ? (
            value.to ? (
              <>
                {format(value.from, 'LLL dd, y')} - {format(value.to, 'LLL dd, y')}
              </>
            ) : (
              format(value.from, 'LLL dd, y')
            )
          ) : (
            placeholder
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          <div className="border-r p-2 space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">Presets</p>
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm"
                onClick={() => handlePresetClick(preset.getValue)}
              >
                {preset.label}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sm text-muted-foreground"
              onClick={handleClear}
            >
              Clear
            </Button>
          </div>
          <div className="p-2">
            <Calendar
              mode="range"
              selected={{ from: value.from, to: value.to }}
              onSelect={(range) => onChange({ from: range?.from, to: range?.to })}
              numberOfMonths={2}
              defaultMonth={value.from || new Date()}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

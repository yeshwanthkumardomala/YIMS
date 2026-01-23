import { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  maxDisplayed?: number;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select items...',
  searchPlaceholder = 'Search...',
  emptyText = 'No items found.',
  className,
  maxDisplayed = 2,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const handleRemove = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== optionValue));
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const selectedLabels = value
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between min-w-[200px]', className)}
        >
          <div className="flex items-center gap-1 flex-wrap flex-1 text-left">
            {value.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : value.length <= maxDisplayed ? (
              value.map((v) => {
                const option = options.find((o) => o.value === v);
                return (
                  <Badge
                    key={v}
                    variant="secondary"
                    className="mr-1 mb-1"
                    style={option?.color ? { backgroundColor: option.color, color: 'white' } : undefined}
                  >
                    {option?.label}
                    <button
                      className="ml-1 hover:bg-secondary-foreground/20 rounded-full"
                      onClick={(e) => handleRemove(v, e)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })
            ) : (
              <Badge variant="secondary">
                {value.length} selected
                <button
                  className="ml-1 hover:bg-secondary-foreground/20 rounded-full"
                  onClick={handleClear}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value.includes(option.value) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.icon && <span className="mr-2">{option.icon}</span>}
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {value.length > 0 && (
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange([])}>
              Clear all
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

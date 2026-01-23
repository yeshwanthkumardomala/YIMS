import { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal } from 'lucide-react';
import type { StockRange } from '@/types/database';

interface StockRangeSliderProps {
  value: StockRange;
  onChange: (range: StockRange) => void;
  max?: number;
  className?: string;
}

export function StockRangeSlider({ value, onChange, max = 1000, className }: StockRangeSliderProps) {
  const [open, setOpen] = useState(false);
  const [localMin, setLocalMin] = useState(value.min.toString());
  const [localMax, setLocalMax] = useState(value.max.toString());

  useEffect(() => {
    setLocalMin(value.min.toString());
    setLocalMax(value.max.toString());
  }, [value]);

  const handleSliderChange = (values: number[]) => {
    onChange({ min: values[0], max: values[1] });
  };

  const handleInputChange = () => {
    const minVal = Math.max(0, parseInt(localMin) || 0);
    const maxVal = Math.min(max, parseInt(localMax) || max);
    onChange({ min: Math.min(minVal, maxVal), max: Math.max(minVal, maxVal) });
  };

  const handleClear = () => {
    onChange({ min: 0, max });
    setOpen(false);
  };

  const isFiltered = value.min > 0 || value.max < max;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={className}>
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          {isFiltered ? `${value.min} - ${value.max}` : 'Stock Range'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Stock Range</Label>
            <Slider
              value={[value.min, value.max]}
              onValueChange={handleSliderChange}
              max={max}
              step={1}
              className="w-full"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Min</Label>
              <Input
                type="number"
                value={localMin}
                onChange={(e) => setLocalMin(e.target.value)}
                onBlur={handleInputChange}
                min={0}
                max={max}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Max</Label>
              <Input
                type="number"
                value={localMax}
                onChange={(e) => setLocalMax(e.target.value)}
                onBlur={handleInputChange}
                min={0}
                max={max}
              />
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full" onClick={handleClear}>
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

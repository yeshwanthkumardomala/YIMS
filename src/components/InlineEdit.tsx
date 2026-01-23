import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Check, X, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface InlineEditProps {
  value: string | number;
  onSave: (newValue: string | number) => Promise<void> | void;
  type?: 'text' | 'number';
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
}

export function InlineEdit({
  value,
  onSave,
  type = 'text',
  className,
  inputClassName,
  disabled = false,
  min,
  max,
  placeholder,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(String(value));
  }, [value]);

  const handleSave = async () => {
    const newValue = type === 'number' ? Number(editValue) : editValue;
    
    if (newValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(newValue);
      setIsEditing(false);
    } catch (error) {
      // Reset to original value on error
      setEditValue(String(value));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(String(value));
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (disabled) {
    return <span className={className}>{value}</span>;
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Small delay to allow button clicks
            setTimeout(() => {
              if (!isSaving) handleCancel();
            }, 150);
          }}
          className={cn('h-7 w-24', inputClassName)}
          min={min}
          max={max}
          placeholder={placeholder}
          disabled={isSaving}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={handleSave}
          disabled={isSaving}
        >
          <Check className="h-3.5 w-3.5 text-green-600" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={handleCancel}
          disabled={isSaving}
        >
          <X className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={cn(
        'group inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 -mx-1.5',
        'hover:bg-muted transition-colors cursor-pointer text-left',
        className
      )}
    >
      <span>{value}</span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

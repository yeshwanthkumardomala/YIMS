import { useState, useEffect } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ItemVariant } from '@/types/database';

interface VariantAttribute {
  name: string;
  values: string[];
}

interface VariantBuilderProps {
  existingVariants?: ItemVariant[];
  onChange: (variants: Omit<ItemVariant, 'id' | 'parent_item_id' | 'created_by' | 'created_at' | 'updated_at'>[]) => void;
  disabled?: boolean;
}

export function VariantBuilder({ existingVariants = [], onChange, disabled }: VariantBuilderProps) {
  const [attributes, setAttributes] = useState<VariantAttribute[]>([]);
  const [newAttributeName, setNewAttributeName] = useState('');
  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [generatedVariants, setGeneratedVariants] = useState<
    { variant_name: string; variant_attributes: Record<string, string>; sku_suffix: string; current_stock: number; minimum_stock: number; is_active: boolean }[]
  >([]);

  // Initialize from existing variants
  useEffect(() => {
    if (existingVariants.length > 0) {
      // Extract attributes from existing variants
      const attrMap: Record<string, Set<string>> = {};
      existingVariants.forEach((v) => {
        Object.entries(v.variant_attributes).forEach(([key, value]) => {
          if (!attrMap[key]) attrMap[key] = new Set();
          attrMap[key].add(value);
        });
      });

      const attrs: VariantAttribute[] = Object.entries(attrMap).map(([name, values]) => ({
        name,
        values: Array.from(values),
      }));
      setAttributes(attrs);

      // Set existing variants
      setGeneratedVariants(
        existingVariants.map((v) => ({
          variant_name: v.variant_name,
          variant_attributes: v.variant_attributes,
          sku_suffix: v.sku_suffix || '',
          current_stock: v.current_stock,
          minimum_stock: v.minimum_stock,
          is_active: v.is_active,
        }))
      );
    }
  }, [existingVariants]);

  const addAttribute = () => {
    if (!newAttributeName.trim()) return;
    if (attributes.some((a) => a.name.toLowerCase() === newAttributeName.toLowerCase())) return;

    setAttributes([...attributes, { name: newAttributeName.trim(), values: [] }]);
    setNewAttributeName('');
  };

  const removeAttribute = (name: string) => {
    setAttributes(attributes.filter((a) => a.name !== name));
    const { [name]: _, ...rest } = newValues;
    setNewValues(rest);
  };

  const addValueToAttribute = (attrName: string) => {
    const value = newValues[attrName]?.trim();
    if (!value) return;

    setAttributes(
      attributes.map((a) => {
        if (a.name !== attrName) return a;
        if (a.values.includes(value)) return a;
        return { ...a, values: [...a.values, value] };
      })
    );
    setNewValues({ ...newValues, [attrName]: '' });
  };

  const removeValueFromAttribute = (attrName: string, value: string) => {
    setAttributes(
      attributes.map((a) => {
        if (a.name !== attrName) return a;
        return { ...a, values: a.values.filter((v) => v !== value) };
      })
    );
  };

  const generateVariants = () => {
    if (attributes.length === 0 || attributes.some((a) => a.values.length === 0)) return;

    // Generate all combinations
    const combinations: Record<string, string>[][] = attributes.map((attr) =>
      attr.values.map((v) => ({ [attr.name]: v }))
    );

    const cartesian = (arr: Record<string, string>[][]): Record<string, string>[] => {
      return arr.reduce(
        (acc, curr) => acc.flatMap((a) => curr.map((c) => ({ ...a, ...c }))),
        [{}]
      );
    };

    const combos = cartesian(combinations);

    const variants = combos.map((combo) => {
      const name = Object.values(combo).join(' - ');
      const suffix = Object.values(combo)
        .map((v) => v.substring(0, 3).toUpperCase())
        .join('-');

      // Check if this variant already exists
      const existing = generatedVariants.find((v) => v.variant_name === name);

      return {
        variant_name: name,
        variant_attributes: combo,
        sku_suffix: existing?.sku_suffix || suffix,
        current_stock: existing?.current_stock || 0,
        minimum_stock: existing?.minimum_stock || 0,
        is_active: existing?.is_active ?? true,
      };
    });

    setGeneratedVariants(variants);
    onChange(variants);
  };

  const updateVariant = (index: number, field: string, value: unknown) => {
    const updated = [...generatedVariants];
    updated[index] = { ...updated[index], [field]: value };
    setGeneratedVariants(updated);
    onChange(updated);
  };

  const removeVariant = (index: number) => {
    const updated = generatedVariants.filter((_, i) => i !== index);
    setGeneratedVariants(updated);
    onChange(updated);
  };

  return (
    <div className="space-y-6">
      {/* Attribute Builder */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Variant Attributes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new attribute */}
          <div className="flex gap-2">
            <Input
              placeholder="Attribute name (e.g., Size, Color)"
              value={newAttributeName}
              onChange={(e) => setNewAttributeName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAttribute()}
              disabled={disabled}
            />
            <Button type="button" onClick={addAttribute} disabled={disabled || !newAttributeName.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {/* Existing attributes */}
          {attributes.map((attr) => (
            <div key={attr.name} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-medium">{attr.name}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttribute(attr.name)}
                  disabled={disabled}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder={`Add ${attr.name.toLowerCase()} value`}
                  value={newValues[attr.name] || ''}
                  onChange={(e) => setNewValues({ ...newValues, [attr.name]: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && addValueToAttribute(attr.name)}
                  disabled={disabled}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => addValueToAttribute(attr.name)}
                  disabled={disabled}
                >
                  Add
                </Button>
              </div>

              <div className="flex flex-wrap gap-1">
                {attr.values.map((value) => (
                  <Badge key={value} variant="secondary" className="gap-1">
                    {value}
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => removeValueFromAttribute(attr.name, value)}
                        className="hover:bg-secondary-foreground/20 rounded-full"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          ))}

          {attributes.length > 0 && attributes.every((a) => a.values.length > 0) && (
            <Button type="button" onClick={generateVariants} disabled={disabled} className="w-full">
              Generate {attributes.reduce((acc, a) => acc * a.values.length, 1)} Variants
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Generated Variants */}
      {generatedVariants.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Generated Variants ({generatedVariants.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Variant</TableHead>
                  <TableHead className="w-24">SKU Suffix</TableHead>
                  <TableHead className="w-20">Stock</TableHead>
                  <TableHead className="w-20">Min</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generatedVariants.map((variant, idx) => (
                  <TableRow key={variant.variant_name}>
                    <TableCell className="font-medium">{variant.variant_name}</TableCell>
                    <TableCell>
                      <Input
                        value={variant.sku_suffix}
                        onChange={(e) => updateVariant(idx, 'sku_suffix', e.target.value)}
                        disabled={disabled}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={variant.current_stock}
                        onChange={(e) => updateVariant(idx, 'current_stock', parseInt(e.target.value) || 0)}
                        disabled={disabled}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={variant.minimum_stock}
                        onChange={(e) => updateVariant(idx, 'minimum_stock', parseInt(e.target.value) || 0)}
                        disabled={disabled}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVariant(idx)}
                        disabled={disabled}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

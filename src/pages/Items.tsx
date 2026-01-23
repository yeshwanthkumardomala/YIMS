import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logSystemEvent } from '@/lib/systemLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Search, Package, Pencil, Trash2, QrCode, Loader2, Copy, Printer, Image as ImageIcon } from 'lucide-react';
import { CodeGenerator } from '@/components/CodeGenerator';
import { BatchCodeGenerator } from '@/components/BatchCodeGenerator';
import { ImageUpload } from '@/components/ImageUpload';
import { VariantBuilder } from '@/components/VariantBuilder';
import { AdvancedFilters } from '@/components/filters/AdvancedFilters';
import type { Item, Category, Location, ItemVariant, ItemFilters } from '@/types/database';

export default function Items() {
  const { canManageInventory } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [codeGeneratorItem, setCodeGeneratorItem] = useState<Item | null>(null);
  const [batchPrintOpen, setBatchPrintOpen] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Filter state using ItemFilters type
  const [filters, setFilters] = useState<ItemFilters>({
    search: '',
    categories: [],
    locations: [],
    stockRange: { min: 0, max: 1000 },
    stockStatus: 'all',
    hasVariants: 'all',
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    location_id: '',
    minimum_stock: 0,
    unit: 'pcs',
    image_url: '',
    has_variants: false,
  });

  const [variants, setVariants] = useState<Omit<ItemVariant, 'id' | 'parent_item_id' | 'created_by' | 'created_at' | 'updated_at'>[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [itemsRes, categoriesRes, locationsRes] = await Promise.all([
        supabase
          .from('items')
          .select('*, category:categories(*), location:locations(*)')
          .eq('is_active', true)
          .order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('locations').select('*').eq('is_active', true).order('name'),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (locationsRes.error) throw locationsRes.error;

      setItems((itemsRes.data as unknown as Item[]) || []);
      setCategories(categoriesRes.data || []);
      setLocations(locationsRes.data || []);

      // Update max stock range based on data
      const maxStock = Math.max(...(itemsRes.data?.map(i => i.current_stock) || [100]), 100);
      setFilters(prev => ({ ...prev, stockRange: { min: 0, max: maxStock } }));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      description: '',
      category_id: '',
      location_id: '',
      minimum_stock: 0,
      unit: 'pcs',
      image_url: '',
      has_variants: false,
    });
    setVariants([]);
    setEditingItem(null);
  }

  function openEditDialog(item: Item) {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      category_id: item.category_id || '',
      location_id: item.location_id || '',
      minimum_stock: item.minimum_stock,
      unit: item.unit,
      image_url: item.image_url || '',
      has_variants: item.has_variants || false,
    });
    setIsDialogOpen(true);
  }

  function handleClone(item: Item) {
    setEditingItem(null);
    setFormData({
      name: `${item.name} (Copy)`,
      description: item.description || '',
      category_id: item.category_id || '',
      location_id: item.location_id || '',
      minimum_stock: item.minimum_stock,
      unit: item.unit,
      image_url: item.image_url || '',
      has_variants: false,
    });
    setVariants([]);
    setIsDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSubmitting(true);
    try {
      if (editingItem) {
        const { error } = await supabase
          .from('items')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            category_id: formData.category_id || null,
            location_id: formData.location_id || null,
            minimum_stock: formData.minimum_stock,
            unit: formData.unit,
            image_url: formData.image_url || null,
            has_variants: formData.has_variants,
          })
          .eq('id', editingItem.id);

        if (error) throw error;
        
        await logSystemEvent({
          eventType: 'item_updated',
          description: `Item "${formData.name}" was updated`,
          metadata: { itemId: editingItem.id, itemCode: editingItem.code, name: formData.name },
        });
        
        toast.success('Item updated successfully');
      } else {
        // Generate code for new item
        const { data: codeData } = await supabase.rpc('generate_item_code');
        const itemCode = codeData || `YIMS:ITEM:${Date.now()}`;
        
        const { data: newItem, error } = await supabase.from('items').insert({
          code: itemCode,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          category_id: formData.category_id || null,
          location_id: formData.location_id || null,
          minimum_stock: formData.minimum_stock,
          unit: formData.unit,
          current_stock: 0,
          image_url: formData.image_url || null,
          has_variants: formData.has_variants,
        }).select('id').single();

        if (error) throw error;

        // Create variants if enabled
        if (formData.has_variants && variants.length > 0 && newItem) {
          const variantsToInsert = variants.map(v => ({
            parent_item_id: newItem.id,
            variant_name: v.variant_name || '',
            variant_attributes: v.variant_attributes || {},
            current_stock: v.current_stock || 0,
            minimum_stock: v.minimum_stock || 0,
            sku_suffix: v.sku_suffix || null,
            is_active: v.is_active ?? true,
          }));

          const { error: variantError } = await supabase
            .from('item_variants')
            .insert(variantsToInsert);

          if (variantError) {
            console.error('Error creating variants:', variantError);
            toast.error('Item created but failed to create variants');
          }
        }
        
        await logSystemEvent({
          eventType: 'item_created',
          description: `New item "${formData.name}" was created`,
          metadata: { itemId: newItem?.id, itemCode, name: formData.name },
        });
        
        toast.success('Item created successfully');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: unknown) {
      console.error('Error saving item:', error);
      toast.error((error as Error).message || 'Failed to save item');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(item: Item) {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('items')
        .update({ is_active: false })
        .eq('id', item.id);

      if (error) throw error;
      
      await logSystemEvent({
        eventType: 'item_deleted',
        description: `Item "${item.name}" was deleted`,
        metadata: { itemId: item.id, itemCode: item.code, name: item.name },
      });
      
      toast.success('Item deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
    }
  }

  const maxStock = Math.max(...items.map(i => i.current_stock), 100);

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !filters.search ||
      item.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      item.code.toLowerCase().includes(filters.search.toLowerCase()) ||
      item.description?.toLowerCase().includes(filters.search.toLowerCase());

    const matchesCategory =
      filters.categories.length === 0 || 
      (item.category_id && filters.categories.includes(item.category_id));

    const matchesLocation =
      filters.locations.length === 0 ||
      (item.location_id && filters.locations.includes(item.location_id));

    const matchesStock =
      item.current_stock >= filters.stockRange.min &&
      item.current_stock <= filters.stockRange.max;

    const matchesStatus = () => {
      if (filters.stockStatus === 'all') return true;
      if (filters.stockStatus === 'out_of_stock' && item.current_stock <= 0) return true;
      if (filters.stockStatus === 'low_stock' && item.current_stock > 0 && item.current_stock < item.minimum_stock) return true;
      if (filters.stockStatus === 'in_stock' && item.current_stock >= item.minimum_stock) return true;
      return false;
    };

    const matchesVariants = () => {
      if (filters.hasVariants === 'all') return true;
      if (filters.hasVariants === 'yes' && item.has_variants) return true;
      if (filters.hasVariants === 'no' && !item.has_variants) return true;
      return false;
    };

    return matchesSearch && matchesCategory && matchesLocation && matchesStock && matchesStatus() && matchesVariants();
  });

  const getStockBadge = (item: Item) => {
    if (item.current_stock <= 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (item.current_stock < item.minimum_stock) {
      return <Badge className="bg-warning text-warning-foreground">Low Stock</Badge>;
    }
    return <Badge className="bg-success/10 text-success border-success/20">In Stock</Badge>;
  };

  const categoryOptions = categories.map(c => ({ value: c.id, label: c.name }));
  const locationOptions = locations.map(l => ({ value: l.id, label: l.name }));

  // Convert items to batch print format
  const batchPrintItems = items.map(i => ({ id: i.id, code: i.code, name: i.name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Items</h1>
          <p className="text-muted-foreground">Manage your inventory items</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBatchPrintOpen(true)}>
            <Printer className="mr-2 h-4 w-4" />
            Batch Print
          </Button>
          {canManageInventory && (
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
                    <DialogDescription>
                      {editingItem
                        ? 'Update the item details below.'
                        : 'Fill in the details to create a new inventory item.'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {/* Image Upload */}
                    <div className="grid gap-2">
                      <Label>Item Image</Label>
                      <ImageUpload
                        value={formData.image_url}
                        onChange={(url) => setFormData({ ...formData, image_url: url || '' })}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter item name"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Enter item description"
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="category">Category</Label>
                        <Select
                          value={formData.category_id}
                          onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="location">Location</Label>
                        <Select
                          value={formData.location_id}
                          onValueChange={(value) => setFormData({ ...formData, location_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select location" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.map((loc) => (
                              <SelectItem key={loc.id} value={loc.id}>
                                {loc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="minimum_stock">Minimum Stock</Label>
                        <Input
                          id="minimum_stock"
                          type="number"
                          min="0"
                          value={formData.minimum_stock}
                          onChange={(e) =>
                            setFormData({ ...formData, minimum_stock: parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="unit">Unit</Label>
                        <Input
                          id="unit"
                          value={formData.unit}
                          onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                          placeholder="pcs, kg, m, etc."
                        />
                      </div>
                    </div>

                    {/* Variants Toggle */}
                    {!editingItem && (
                      <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <Label htmlFor="has_variants">Enable Variants</Label>
                          <p className="text-sm text-muted-foreground">
                            Create variations like size, color, etc.
                          </p>
                        </div>
                        <Switch
                          id="has_variants"
                          checked={formData.has_variants}
                          onCheckedChange={(checked) => setFormData({ ...formData, has_variants: checked })}
                        />
                      </div>
                    )}

                    {formData.has_variants && !editingItem && (
                      <VariantBuilder
                        onChange={setVariants}
                      />
                    )}
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingItem ? 'Update' : 'Create'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                {showAdvancedFilters ? 'Hide Filters' : 'Advanced Filters'}
              </Button>
            </div>

            {showAdvancedFilters && (
              <AdvancedFilters
                type="items"
                filters={filters}
                onChange={setFilters}
                categoryOptions={categoryOptions}
                locationOptions={locationOptions}
                maxStock={maxStock}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Inventory Items
            <Badge variant="secondary" className="ml-2">
              {filteredItems.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-medium">No items found</h3>
              <p className="text-muted-foreground">
                {filters.search || filters.categories.length > 0 || filters.locations.length > 0
                  ? 'Try adjusting your search or filters'
                  : 'Get started by adding your first item'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.image_url ? (
                        <img 
                          src={item.image_url} 
                          alt={item.name} 
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.code}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {item.name}
                        {item.has_variants && (
                          <Badge variant="outline" className="text-xs">Variants</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(item as unknown as { category?: { name: string } }).category?.name || '-'}
                    </TableCell>
                    <TableCell>
                      {(item as unknown as { location?: { name: string } }).location?.name || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.current_stock} {item.unit}
                    </TableCell>
                    <TableCell>{getStockBadge(item)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCodeGeneratorItem(item)}
                          title="Generate Code"
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                        {canManageInventory && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleClone(item)}
                              title="Clone Item"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(item)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Code Generator Dialog */}
      <CodeGenerator
        open={!!codeGeneratorItem}
        onOpenChange={(open) => !open && setCodeGeneratorItem(null)}
        code={codeGeneratorItem?.code || ''}
        name={codeGeneratorItem?.name || ''}
        type="item"
      />

      {/* Batch Code Generator Dialog */}
      <BatchCodeGenerator
        open={batchPrintOpen}
        onOpenChange={setBatchPrintOpen}
        items={batchPrintItems}
      />
    </div>
  );
}

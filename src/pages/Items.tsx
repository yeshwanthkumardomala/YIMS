import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { toast } from 'sonner';
import { Plus, Search, Package, Pencil, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import type { Item, Category, Location } from '@/types/database';

export default function Items() {
  const { canManageInventory } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    location_id: '',
    minimum_stock: 0,
    unit: 'pcs',
  });

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
    });
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
    });
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
          })
          .eq('id', editingItem.id);

        if (error) throw error;
        toast.success('Item updated successfully');
      } else {
        // Generate code for new item
        const { data: codeData } = await supabase.rpc('generate_item_code');
        
        const { error } = await supabase.from('items').insert({
          code: codeData || `YIMS:ITEM:${Date.now()}`,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          category_id: formData.category_id || null,
          location_id: formData.location_id || null,
          minimum_stock: formData.minimum_stock,
          unit: formData.unit,
          current_stock: 0,
        });

        if (error) throw error;
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
      toast.success('Item deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
    }
  }

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === 'all' || item.category_id === categoryFilter;
    return matchesSearch && matchesCategory;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Items</h1>
          <p className="text-muted-foreground">Manage your inventory items</p>
        </div>
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
            <DialogContent className="sm:max-w-[500px]">
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

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                {searchQuery || categoryFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Get started by adding your first item'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Status</TableHead>
                  {canManageInventory && <TableHead className="w-[100px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.code}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
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
                    {canManageInventory && (
                      <TableCell>
                        <div className="flex gap-2">
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
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logSystemEvent } from '@/lib/systemLogger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Plus,
  Tags,
  Pencil,
  Trash2,
  Loader2,
  Package,
  Beaker,
  Wrench,
  BookOpen,
  Laptop,
  Paintbrush,
  Scissors,
  Hammer,
  Lightbulb,
  Music,
  Camera,
  Headphones,
  Cpu,
  Zap,
  Folder,
  type LucideIcon,
} from 'lucide-react';
import { ExportDropdown } from '@/components/ExportDropdown';
import { toCSV, downloadCSV } from '@/lib/csvUtils';
import { downloadExcelSingleSheet } from '@/lib/excelUtils';

// Available icons for categories
const CATEGORY_ICONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'package', label: 'Package', icon: Package },
  { value: 'beaker', label: 'Lab Equipment', icon: Beaker },
  { value: 'wrench', label: 'Tools', icon: Wrench },
  { value: 'book', label: 'Books', icon: BookOpen },
  { value: 'laptop', label: 'Electronics', icon: Laptop },
  { value: 'paintbrush', label: 'Art Supplies', icon: Paintbrush },
  { value: 'scissors', label: 'Crafts', icon: Scissors },
  { value: 'hammer', label: 'Hardware', icon: Hammer },
  { value: 'lightbulb', label: 'Electrical', icon: Lightbulb },
  { value: 'music', label: 'Music', icon: Music },
  { value: 'camera', label: 'Photography', icon: Camera },
  { value: 'headphones', label: 'Audio', icon: Headphones },
  { value: 'cpu', label: 'Components', icon: Cpu },
  { value: 'zap', label: 'Power', icon: Zap },
  { value: 'folder', label: 'General', icon: Folder },
];

// Preset colors for categories
const CATEGORY_COLORS = [
  { value: '#6366f1', label: 'Indigo' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#d946ef', label: 'Fuchsia' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#f43f5e', label: 'Rose' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#22c55e', label: 'Green' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#0ea5e9', label: 'Sky' },
  { value: '#3b82f6', label: 'Blue' },
];

const CATEGORY_CSV_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'icon', label: 'Icon' },
  { key: 'color', label: 'Color' },
  { key: 'item_count', label: 'Item Count' },
] as const;

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

export default function Categories() {
  const { canManageInventory } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6366f1',
    icon: 'package',
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (categoriesError) throw categoriesError;

      // Fetch item counts per category
      const { data: itemCounts, error: countError } = await supabase
        .from('items')
        .select('category_id')
        .eq('is_active', true);

      if (countError) throw countError;

      // Count items per category
      const countMap = new Map<string, number>();
      itemCounts?.forEach((item) => {
        if (item.category_id) {
          countMap.set(item.category_id, (countMap.get(item.category_id) || 0) + 1);
        }
      });

      // Combine data
      const categoriesWithCounts: Category[] = (categoriesData || []).map((cat) => ({
        ...cat,
        color: cat.color || '#6366f1',
        icon: cat.icon || 'package',
        is_active: cat.is_active ?? true,
        item_count: countMap.get(cat.id) || 0,
      }));

      setCategories(categoriesWithCounts);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      description: '',
      color: '#6366f1',
      icon: 'package',
    });
    setEditingCategory(null);
  }

  function openEditDialog(category: Category) {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color,
      icon: category.icon,
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
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            color: formData.color,
            icon: formData.icon,
          })
          .eq('id', editingCategory.id);

        if (error) throw error;

        await logSystemEvent({
          eventType: 'item_updated',
          description: `Category "${formData.name}" was updated`,
          metadata: { categoryId: editingCategory.id, name: formData.name },
        });

        toast.success('Category updated successfully');
      } else {
        const { data: newCategory, error } = await supabase
          .from('categories')
          .insert({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            color: formData.color,
            icon: formData.icon,
          })
          .select('id')
          .single();

        if (error) throw error;

        await logSystemEvent({
          eventType: 'item_created',
          description: `New category "${formData.name}" was created`,
          metadata: { categoryId: newCategory?.id, name: formData.name },
        });

        toast.success('Category created successfully');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchCategories();
    } catch (error: unknown) {
      console.error('Error saving category:', error);
      toast.error((error as Error).message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(category: Category) {
    if (category.item_count && category.item_count > 0) {
      toast.error(`Cannot delete category with ${category.item_count} items. Reassign items first.`);
      return;
    }

    if (!confirm(`Are you sure you want to delete "${category.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', category.id);

      if (error) throw error;

      await logSystemEvent({
        eventType: 'item_deleted',
        description: `Category "${category.name}" was deleted`,
        metadata: { categoryId: category.id, name: category.name },
      });

      toast.success('Category deleted successfully');
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category');
    }
  }

  function getIconComponent(iconName: string): LucideIcon {
    const found = CATEGORY_ICONS.find((i) => i.value === iconName);
    return found?.icon || Package;
  }

  function formatCategoriesForExport() {
    return categories.map((cat) => ({
      name: cat.name,
      description: cat.description || '',
      icon: cat.icon,
      color: cat.color,
      item_count: cat.item_count || 0,
    }));
  }

  function exportAllCSV() {
    const formatted = formatCategoriesForExport();
    const csv = toCSV(formatted, CATEGORY_CSV_COLUMNS);
    downloadCSV(csv, `categories-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Exported categories to CSV');
  }

  async function exportExcel() {
    try {
      const formatted = formatCategoriesForExport();
      await downloadExcelSingleSheet(formatted, CATEGORY_CSV_COLUMNS, `categories-${new Date().toISOString().split('T')[0]}.xlsx`, 'Categories');
      toast.success('Exported categories to Excel');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Failed to export Excel file');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground">Organize items into categories with colors and icons</p>
        </div>
        <div className="flex gap-2">
          <ExportDropdown
            onExportCSV={exportAllCSV}
            onExportExcel={exportExcel}
            totalCount={categories.length}
          />
          {canManageInventory && (
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Category
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingCategory ? 'Edit Category' : 'Add New Category'}</DialogTitle>
                  <DialogDescription>
                    {editingCategory
                      ? 'Update the category details below.'
                      : 'Create a new category for organizing items.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter category name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Enter description"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Icon</Label>
                      <Select
                        value={formData.icon}
                        onValueChange={(value) => setFormData({ ...formData, icon: value })}
                      >
                        <SelectTrigger>
                          <SelectValue>
                            <div className="flex items-center gap-2">
                              {(() => {
                                const IconComp = getIconComponent(formData.icon);
                                return <IconComp className="h-4 w-4" />;
                              })()}
                              {CATEGORY_ICONS.find((i) => i.value === formData.icon)?.label}
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORY_ICONS.map((iconOption) => (
                            <SelectItem key={iconOption.value} value={iconOption.value}>
                              <div className="flex items-center gap-2">
                                <iconOption.icon className="h-4 w-4" />
                                {iconOption.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Color</Label>
                      <Select
                        value={formData.color}
                        onValueChange={(value) => setFormData({ ...formData, color: value })}
                      >
                        <SelectTrigger>
                          <SelectValue>
                            <div className="flex items-center gap-2">
                              <div
                                className="h-4 w-4 rounded-full"
                                style={{ backgroundColor: formData.color }}
                              />
                              {CATEGORY_COLORS.find((c) => c.value === formData.color)?.label || 'Custom'}
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORY_COLORS.map((colorOption) => (
                            <SelectItem key={colorOption.value} value={colorOption.value}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-4 w-4 rounded-full"
                                  style={{ backgroundColor: colorOption.value }}
                                />
                                {colorOption.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="rounded-lg border p-4">
                    <p className="text-sm font-medium mb-2 text-muted-foreground">Preview</p>
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg"
                        style={{ backgroundColor: formData.color + '20', color: formData.color }}
                      >
                        {(() => {
                          const IconComp = getIconComponent(formData.icon);
                          return <IconComp className="h-5 w-5" />;
                        })()}
                      </div>
                      <div>
                        <p className="font-medium">{formData.name || 'Category Name'}</p>
                        <p className="text-sm text-muted-foreground">
                          {formData.description || 'Description'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingCategory ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" />
            Categories
            <Badge variant="secondary" className="ml-2">
              {categories.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="py-12 text-center">
              <Tags className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-medium">No categories yet</h3>
              <p className="text-muted-foreground">
                Create your first category to organize items
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => {
                  const IconComp = getIconComponent(category.icon);
                  return (
                    <TableRow key={category.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-lg"
                            style={{
                              backgroundColor: category.color + '20',
                              color: category.color,
                            }}
                          >
                            <IconComp className="h-5 w-5" />
                          </div>
                          <span className="font-medium">{category.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {category.description || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{category.item_count || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        {canManageInventory && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(category)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(category)}
                              className="text-destructive hover:text-destructive"
                              disabled={!!category.item_count && category.item_count > 0}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

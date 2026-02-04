import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, FolderPlus, MapPin, Package, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type LocationType = Database['public']['Enums']['location_type'];

interface Category {
  id: string;
  name: string;
  color: string | null;
}

interface Location {
  id: string;
  name: string;
  code: string;
  location_type: LocationType;
}

const LOCATION_TYPES: LocationType[] = ['building', 'room', 'shelf', 'box', 'drawer'];
const COLOR_OPTIONS = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#22c55e', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#6b7280', label: 'Gray' },
];

export function QuickAddSection() {
  const [activeTab, setActiveTab] = useState('category');
  const [isLoading, setIsLoading] = useState(false);
  
  // Data for dropdowns
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Category form
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState('#3b82f6');
  const [categoryDescription, setCategoryDescription] = useState('');

  // Location form
  const [locationName, setLocationName] = useState('');
  const [locationType, setLocationType] = useState<LocationType>('room');
  const [locationParentId, setLocationParentId] = useState<string>('');
  const [locationDescription, setLocationDescription] = useState('');

  // Item form
  const [itemName, setItemName] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState<string>('');
  const [itemLocationId, setItemLocationId] = useState<string>('');
  const [itemInitialStock, setItemInitialStock] = useState('0');
  const [itemMinStock, setItemMinStock] = useState('0');
  const [itemUnit, setItemUnit] = useState('pcs');

  // Fetch categories and locations
  const fetchData = async () => {
    const [catResult, locResult] = await Promise.all([
      supabase.from('categories').select('id, name, color').eq('is_active', true).order('name'),
      supabase.from('locations').select('id, name, code, location_type').eq('is_active', true).order('name'),
    ]);
    
    if (catResult.data) setCategories(catResult.data);
    if (locResult.data) setLocations(locResult.data);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetCategoryForm = () => {
    setCategoryName('');
    setCategoryColor('#3b82f6');
    setCategoryDescription('');
  };

  const resetLocationForm = () => {
    setLocationName('');
    setLocationType('room');
    setLocationParentId('');
    setLocationDescription('');
  };

  const resetItemForm = () => {
    setItemName('');
    setItemCategoryId('');
    setItemLocationId('');
    setItemInitialStock('0');
    setItemMinStock('0');
    setItemUnit('pcs');
  };

  const handleAddCategory = async () => {
    if (!categoryName.trim()) {
      toast({ title: 'Error', description: 'Category name is required', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from('categories').insert({
        name: categoryName.trim(),
        color: categoryColor,
        description: categoryDescription.trim() || null,
      });

      if (error) throw error;

      toast({ title: 'Success', description: `Category "${categoryName}" added successfully` });
      resetCategoryForm();
      fetchData(); // Refresh dropdowns
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLocation = async () => {
    if (!locationName.trim()) {
      toast({ title: 'Error', description: 'Location name is required', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      // Generate location code
      const { data: codeData, error: codeError } = await supabase.rpc('generate_location_code', {
        _type: locationType,
      });

      if (codeError) throw codeError;

      const { error } = await supabase.from('locations').insert({
        name: locationName.trim(),
        code: codeData,
        location_type: locationType,
        parent_id: locationParentId || null,
        description: locationDescription.trim() || null,
      });

      if (error) throw error;

      toast({ title: 'Success', description: `Location "${locationName}" added successfully` });
      resetLocationForm();
      fetchData(); // Refresh dropdowns
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!itemName.trim()) {
      toast({ title: 'Error', description: 'Item name is required', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      // Generate item code
      const { data: codeData, error: codeError } = await supabase.rpc('generate_item_code');

      if (codeError) throw codeError;

      const { error } = await supabase.from('items').insert({
        name: itemName.trim(),
        code: codeData,
        category_id: itemCategoryId || null,
        location_id: itemLocationId || null,
        current_stock: parseInt(itemInitialStock) || 0,
        minimum_stock: parseInt(itemMinStock) || 0,
        unit: itemUnit,
      });

      if (error) throw error;

      toast({ title: 'Success', description: `Item "${itemName}" added successfully` });
      resetItemForm();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Quick Add
        </CardTitle>
        <CardDescription>
          Add individual records before bulk import
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="category" className="gap-2">
              <FolderPlus className="h-4 w-4" />
              Category
            </TabsTrigger>
            <TabsTrigger value="location" className="gap-2">
              <MapPin className="h-4 w-4" />
              Location
            </TabsTrigger>
            <TabsTrigger value="item" className="gap-2">
              <Package className="h-4 w-4" />
              Item
            </TabsTrigger>
          </TabsList>

          {/* Category Tab */}
          <TabsContent value="category" className="space-y-4 mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cat-name">Name *</Label>
                <Input
                  id="cat-name"
                  placeholder="e.g., Electronics"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-color">Color</Label>
                <Select value={categoryColor} onValueChange={setCategoryColor}>
                  <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: categoryColor }}
                        />
                        {COLOR_OPTIONS.find((c) => c.value === categoryColor)?.label || 'Blue'}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-4 w-4 rounded-full"
                            style={{ backgroundColor: color.value }}
                          />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea
                id="cat-desc"
                placeholder="Optional description..."
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetCategoryForm} disabled={isLoading}>
                Clear
              </Button>
              <Button onClick={handleAddCategory} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Category
              </Button>
            </div>
          </TabsContent>

          {/* Location Tab */}
          <TabsContent value="location" className="space-y-4 mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="loc-name">Name *</Label>
                <Input
                  id="loc-name"
                  placeholder="e.g., Lab Room 101"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc-type">Type *</Label>
                <Select value={locationType} onValueChange={(v) => setLocationType(v as LocationType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="loc-parent">Parent Location</Label>
                <Select value={locationParentId} onValueChange={setLocationParentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="None (top-level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None (top-level)</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name} ({loc.location_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc-desc">Description</Label>
                <Input
                  id="loc-desc"
                  placeholder="Optional description..."
                  value={locationDescription}
                  onChange={(e) => setLocationDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetLocationForm} disabled={isLoading}>
                Clear
              </Button>
              <Button onClick={handleAddLocation} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Location
              </Button>
            </div>
          </TabsContent>

          {/* Item Tab */}
          <TabsContent value="item" className="space-y-4 mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="item-name">Name *</Label>
                <Input
                  id="item-name"
                  placeholder="e.g., Arduino Uno"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-unit">Unit</Label>
                <Select value={itemUnit} onValueChange={setItemUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="pack">Pack</SelectItem>
                    <SelectItem value="set">Set</SelectItem>
                    <SelectItem value="kg">Kilogram (kg)</SelectItem>
                    <SelectItem value="m">Meter (m)</SelectItem>
                    <SelectItem value="L">Liter (L)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="item-cat">Category</Label>
                <Select value={itemCategoryId} onValueChange={setItemCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No category</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          {cat.color && (
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                          )}
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-loc">Location</Label>
                <Select value={itemLocationId} onValueChange={setItemLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No location</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name} ({loc.location_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="item-stock">Initial Stock</Label>
                <Input
                  id="item-stock"
                  type="number"
                  min="0"
                  value={itemInitialStock}
                  onChange={(e) => setItemInitialStock(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-min">Minimum Stock</Label>
                <Input
                  id="item-min"
                  type="number"
                  min="0"
                  value={itemMinStock}
                  onChange={(e) => setItemMinStock(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetItemForm} disabled={isLoading}>
                Clear
              </Button>
              <Button onClick={handleAddItem} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Item
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

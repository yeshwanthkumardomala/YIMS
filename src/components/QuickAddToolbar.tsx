import { useState } from 'react';
import { Plus, X, Tags, MapPin, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { useOfflineCategories } from '@/hooks/useOfflineCategories';
import { useOfflineLocations } from '@/hooks/useOfflineLocations';
import { useOfflineItems } from '@/hooks/useOfflineItems';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6',
];

const LOCATION_TYPES = [
  { value: 'building', label: 'Building' },
  { value: 'room', label: 'Room' },
  { value: 'shelf', label: 'Shelf' },
  { value: 'box', label: 'Box' },
  { value: 'drawer', label: 'Drawer' },
  { value: 'custom', label: 'Custom' },
];

export function QuickAddToolbar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeDialog, setActiveDialog] = useState<'category' | 'location' | 'item' | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { isOfflineMode } = useOfflineMode();
  const offlineCategories = useOfflineCategories();
  const offlineLocations = useOfflineLocations();
  const offlineItems = useOfflineItems();

  // Form states
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState(CATEGORY_COLORS[0]);

  const [locationName, setLocationName] = useState('');
  const [locationType, setLocationType] = useState<string>('room');
  const [customTypeLabel, setCustomTypeLabel] = useState('');

  const [itemName, setItemName] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState<string>('');
  const [itemLocationId, setItemLocationId] = useState<string>('');
  const [itemStock, setItemStock] = useState(0);

  const resetForms = () => {
    setCategoryName('');
    setCategoryColor(CATEGORY_COLORS[0]);
    setLocationName('');
    setLocationType('room');
    setCustomTypeLabel('');
    setItemName('');
    setItemCategoryId('');
    setItemLocationId('');
    setItemStock(0);
  };

  const closeDialog = () => {
    setActiveDialog(null);
    resetForms();
  };

  const handleCreateCategory = async () => {
    if (!categoryName.trim()) {
      toast.error('Category name is required');
      return;
    }

    setIsLoading(true);
    try {
      if (isOfflineMode) {
        const result = await offlineCategories.createCategory({
          name: categoryName.trim(),
          color: categoryColor,
          description: null,
          icon: null,
          isActive: 1 as unknown as boolean,
        });
        if (!result.success) throw new Error(result.error);
      } else {
        const { error } = await supabase.from('categories').insert({
          name: categoryName.trim(),
          color: categoryColor,
        });
        if (error) throw error;
      }

      toast.success('Category created!');
      closeDialog();
      setIsExpanded(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create category');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLocation = async () => {
    if (!locationName.trim()) {
      toast.error('Location name is required');
      return;
    }

    if (locationType === 'custom' && !customTypeLabel.trim()) {
      toast.error('Custom type label is required');
      return;
    }

    setIsLoading(true);
    try {
      // Determine database type and custom label
      const dbLocationType = locationType === 'custom' ? 'box' : locationType;
      const customLabel = locationType === 'custom' ? customTypeLabel.trim() : null;

      if (isOfflineMode) {
        const result = await offlineLocations.createLocation({
          name: locationName.trim(),
          locationType: dbLocationType as 'building' | 'room' | 'shelf' | 'box' | 'drawer',
          description: null,
          parentId: null,
          isActive: 1 as unknown as boolean,
        });
        if (!result.success) throw new Error(result.error);
      } else {
        const { data: codeData } = await supabase.rpc('generate_location_code', {
          _type: dbLocationType as 'building' | 'room' | 'shelf' | 'box' | 'drawer',
        });

        const { error } = await supabase.from('locations').insert([{
          name: locationName.trim(),
          location_type: dbLocationType as 'building' | 'room' | 'shelf' | 'box' | 'drawer',
          custom_type_label: customLabel,
          code: codeData || `LOC-${Date.now()}`,
        }]);
        if (error) throw error;
      }

      toast.success('Location created!');
      closeDialog();
      setIsExpanded(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create location');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateItem = async () => {
    if (!itemName.trim()) {
      toast.error('Item name is required');
      return;
    }

    setIsLoading(true);
    try {
      if (isOfflineMode) {
        const result = await offlineItems.createItem({
          name: itemName.trim(),
          categoryId: itemCategoryId ? parseInt(itemCategoryId) : null,
          locationId: itemLocationId ? parseInt(itemLocationId) : null,
          currentStock: itemStock,
          minimumStock: 10,
          unit: 'pcs',
          description: null,
          imageUrl: null,
          hasVariants: false,
          isActive: 1 as unknown as boolean,
        });
        if (!result.success) throw new Error(result.error);
      } else {
        const { data: codeData } = await supabase.rpc('generate_item_code');

        const { error } = await supabase.from('items').insert([{
          name: itemName.trim(),
          code: codeData || `ITM-${Date.now()}`,
          category_id: itemCategoryId || null,
          location_id: itemLocationId || null,
          current_stock: itemStock,
          minimum_stock: 10,
          unit: 'pcs',
        }]);
        if (error) throw error;
      }

      toast.success('Item created!');
      closeDialog();
      setIsExpanded(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create item');
    } finally {
      setIsLoading(false);
    }
  };

  // Get categories and locations for dropdowns
  const categories = isOfflineMode 
    ? offlineCategories.categories 
    : [];
  const locations = isOfflineMode 
    ? offlineLocations.locations 
    : [];

  return (
    <TooltipProvider>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-2">
        {/* Quick action buttons - shown when expanded */}
        <div className={cn(
          "flex flex-col-reverse gap-2 transition-all duration-300",
          isExpanded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="secondary"
                className="h-12 w-12 rounded-full shadow-lg bg-green-500 hover:bg-green-600 text-white"
                onClick={() => setActiveDialog('category')}
              >
                <Tags className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Add Category</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="secondary"
                className="h-12 w-12 rounded-full shadow-lg bg-blue-500 hover:bg-blue-600 text-white"
                onClick={() => setActiveDialog('location')}
              >
                <MapPin className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Add Location</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="secondary"
                className="h-12 w-12 rounded-full shadow-lg bg-purple-500 hover:bg-purple-600 text-white"
                onClick={() => setActiveDialog('item')}
              >
                <Package className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Add Item</TooltipContent>
          </Tooltip>
        </div>

        {/* Main FAB */}
        <Button
          size="icon"
          className={cn(
            "h-14 w-14 rounded-full shadow-lg transition-transform duration-300",
            isExpanded && "rotate-45"
          )}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>
      </div>

      {/* Category Dialog */}
      <Dialog open={activeDialog === 'category'} onOpenChange={() => closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5 text-green-500" />
              Quick Add Category
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                placeholder="e.g., Electronics, Tools"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-transform",
                      categoryColor === color ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setCategoryColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          {locationType === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="location-custom-label">Custom Type Label *</Label>
              <Input
                id="location-custom-label"
                placeholder="e.g., Cabinet, Rack"
                value={customTypeLabel}
                onChange={(e) => setCustomTypeLabel(e.target.value)}
                autoFocus
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleCreateCategory} disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Dialog */}
      <Dialog open={activeDialog === 'location'} onOpenChange={() => closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-500" />
              Quick Add Location
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="location-name">Name</Label>
              <Input
                id="location-name"
                placeholder="e.g., Warehouse A, Shelf 1"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-type">Type</Label>
              <Select value={locationType} onValueChange={setLocationType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleCreateLocation} disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={activeDialog === 'item'} onOpenChange={() => closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-500" />
              Quick Add Item
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                placeholder="e.g., Screwdriver, Cable"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                autoFocus
              />
            </div>
            {categories.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="item-category">Category (optional)</Label>
                <Select value={itemCategoryId} onValueChange={setItemCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {locations.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="item-location">Location (optional)</Label>
                <Select value={itemLocationId} onValueChange={setItemLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={String(loc.id)}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="item-stock">Initial Stock</Label>
              <Input
                id="item-stock"
                type="number"
                min={0}
                value={itemStock}
                onChange={(e) => setItemStock(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleCreateItem} disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

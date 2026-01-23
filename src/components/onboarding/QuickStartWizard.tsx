import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useOfflineMode } from '@/contexts/OfflineModeContext';
import { useOfflineCategories } from '@/hooks/useOfflineCategories';
import { useOfflineLocations } from '@/hooks/useOfflineLocations';
import { useOfflineItems } from '@/hooks/useOfflineItems';
import {
  Rocket,
  Tags,
  MapPin,
  Package,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  X,
} from 'lucide-react';

interface QuickStartWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

type Step = 'welcome' | 'category' | 'location' | 'item' | 'complete';

const STEPS: { id: Step; label: string; icon: React.ReactNode }[] = [
  { id: 'welcome', label: 'Welcome', icon: <Rocket className="h-4 w-4" /> },
  { id: 'category', label: 'Category', icon: <Tags className="h-4 w-4" /> },
  { id: 'location', label: 'Location', icon: <MapPin className="h-4 w-4" /> },
  { id: 'item', label: 'Item', icon: <Package className="h-4 w-4" /> },
  { id: 'complete', label: 'Done', icon: <CheckCircle2 className="h-4 w-4" /> },
];

const CATEGORY_COLORS = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#22c55e', label: 'Green' },
  { value: '#f59e0b', label: 'Orange' },
  { value: '#ef4444', label: 'Red' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#06b6d4', label: 'Cyan' },
];

const LOCATION_TYPES = [
  { value: 'building', label: 'Building' },
  { value: 'room', label: 'Room' },
  { value: 'shelf', label: 'Shelf' },
  { value: 'box', label: 'Box' },
  { value: 'drawer', label: 'Drawer' },
] as const;

export function QuickStartWizard({ open, onOpenChange, onComplete }: QuickStartWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isOfflineMode } = useOfflineMode();
  
  // Offline hooks
  const offlineCategories = useOfflineCategories();
  const offlineLocations = useOfflineLocations();
  const offlineItems = useOfflineItems();
  
  // Form state
  const [categoryData, setCategoryData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
  });
  
  const [locationData, setLocationData] = useState({
    name: '',
    description: '',
    locationType: 'room' as typeof LOCATION_TYPES[number]['value'],
  });
  
  const [itemData, setItemData] = useState({
    name: '',
    description: '',
    minimumStock: 5,
    currentStock: 10,
    unit: 'pcs',
  });
  
  // Created IDs for linking
  const [createdCategoryId, setCreatedCategoryId] = useState<string | null>(null);
  const [createdLocationId, setCreatedLocationId] = useState<string | null>(null);

  const stepIndex = STEPS.findIndex(s => s.id === currentStep);
  const progress = ((stepIndex) / (STEPS.length - 1)) * 100;

  const handleNext = () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].id);
    }
  };

  const handleBack = () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
    }
  };

  const handleCreateCategory = async () => {
    if (!categoryData.name.trim()) {
      toast({ title: 'Error', description: 'Category name is required', variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    try {
      if (isOfflineMode) {
        const result = await offlineCategories.createCategory({
          name: categoryData.name,
          description: categoryData.description || null,
          color: categoryData.color,
          icon: null,
          isActive: true,
        });
        if (result.success && result.id) {
          setCreatedCategoryId(String(result.id));
          toast({ title: 'Success', description: 'Category created!' });
          handleNext();
        }
      } else {
        const { data, error } = await supabase
          .from('categories')
          .insert({
            name: categoryData.name,
            description: categoryData.description || null,
            color: categoryData.color,
          })
          .select('id')
          .single();
        
        if (error) throw error;
        setCreatedCategoryId(data.id);
        toast({ title: 'Success', description: 'Category created!' });
        handleNext();
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLocation = async () => {
    if (!locationData.name.trim()) {
      toast({ title: 'Error', description: 'Location name is required', variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    try {
      if (isOfflineMode) {
        const result = await offlineLocations.createLocation({
          name: locationData.name,
          description: locationData.description || null,
          locationType: locationData.locationType,
          parentId: null,
          isActive: true,
        });
        if (result.success && result.id) {
          setCreatedLocationId(String(result.id));
          toast({ title: 'Success', description: 'Location created!' });
          handleNext();
        }
      } else {
        // Generate location code
        const { data: codeData } = await supabase.rpc('generate_location_code', {
          _type: locationData.locationType,
        });
        
        const { data, error } = await supabase
          .from('locations')
          .insert({
            name: locationData.name,
            description: locationData.description || null,
            location_type: locationData.locationType,
            code: codeData || `LOC-${Date.now()}`,
          })
          .select('id')
          .single();
        
        if (error) throw error;
        setCreatedLocationId(data.id);
        toast({ title: 'Success', description: 'Location created!' });
        handleNext();
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateItem = async () => {
    if (!itemData.name.trim()) {
      toast({ title: 'Error', description: 'Item name is required', variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    try {
      if (isOfflineMode) {
        const result = await offlineItems.createItem({
          name: itemData.name,
          description: itemData.description || null,
          categoryId: createdCategoryId ? parseInt(createdCategoryId) : null,
          locationId: createdLocationId ? parseInt(createdLocationId) : null,
          currentStock: itemData.currentStock,
          minimumStock: itemData.minimumStock,
          unit: itemData.unit,
          imageUrl: null,
          hasVariants: false,
          isActive: true,
        });
        if (result.success) {
          toast({ title: 'Success', description: 'Item created!' });
          handleNext();
        }
      } else {
        // Generate item code
        const { data: codeData } = await supabase.rpc('generate_item_code');
        
        const { error } = await supabase
          .from('items')
          .insert({
            name: itemData.name,
            description: itemData.description || null,
            category_id: createdCategoryId,
            location_id: createdLocationId,
            current_stock: itemData.currentStock,
            minimum_stock: itemData.minimumStock,
            unit: itemData.unit,
            code: codeData || `ITEM-${Date.now()}`,
          });
        
        if (error) throw error;
        toast({ title: 'Success', description: 'Item created!' });
        handleNext();
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    // Mark wizard as completed
    localStorage.setItem('yims-wizard-completed', 'true');
    onComplete();
    onOpenChange(false);
    navigate('/');
  };

  const handleSkip = () => {
    localStorage.setItem('yims-wizard-completed', 'true');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <DialogTitle>Quick Start Setup</DialogTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
              Skip
            </Button>
          </div>
          <DialogDescription>
            Let's set up your inventory system in a few easy steps
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-3">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`flex flex-col items-center gap-1 ${
                  index <= stepIndex ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                    index < stepIndex
                      ? 'border-primary bg-primary text-primary-foreground'
                      : index === stepIndex
                      ? 'border-primary bg-background'
                      : 'border-muted bg-background'
                  }`}
                >
                  {index < stepIndex ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    step.icon
                  )}
                </div>
                <span className="text-xs hidden sm:block">{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[200px] py-4">
          {currentStep === 'welcome' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Rocket className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Welcome to YIMS!</h3>
              <p className="text-muted-foreground">
                This quick setup will help you create your first category, location, and inventory item.
                It only takes a minute!
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Badge variant="secondary">
                  <Tags className="mr-1 h-3 w-3" />
                  1 Category
                </Badge>
                <Badge variant="secondary">
                  <MapPin className="mr-1 h-3 w-3" />
                  1 Location
                </Badge>
                <Badge variant="secondary">
                  <Package className="mr-1 h-3 w-3" />
                  1 Item
                </Badge>
              </div>
            </div>
          )}

          {currentStep === 'category' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Tags className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold">Create a Category</h3>
                  <p className="text-sm text-muted-foreground">
                    Categories help organize your items
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="cat-name">Category Name *</Label>
                  <Input
                    id="cat-name"
                    placeholder="e.g., Office Supplies, Electronics"
                    value={categoryData.name}
                    onChange={(e) => setCategoryData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cat-desc">Description (optional)</Label>
                  <Textarea
                    id="cat-desc"
                    placeholder="Brief description of this category"
                    value={categoryData.description}
                    onChange={(e) => setCategoryData(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex gap-2">
                    {CATEGORY_COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        className={`h-8 w-8 rounded-full border-2 transition-transform ${
                          categoryData.color === color.value
                            ? 'border-foreground scale-110'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color.value }}
                        onClick={() => setCategoryData(prev => ({ ...prev, color: color.value }))}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'location' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                  <MapPin className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <h3 className="font-semibold">Create a Location</h3>
                  <p className="text-sm text-muted-foreground">
                    Where will you store your items?
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="loc-name">Location Name *</Label>
                  <Input
                    id="loc-name"
                    placeholder="e.g., Main Storage, Room 101"
                    value={locationData.name}
                    onChange={(e) => setLocationData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="loc-type">Location Type</Label>
                  <Select
                    value={locationData.locationType}
                    onValueChange={(value: typeof LOCATION_TYPES[number]['value']) => 
                      setLocationData(prev => ({ ...prev, locationType: value }))
                    }
                  >
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
                
                <div className="space-y-2">
                  <Label htmlFor="loc-desc">Description (optional)</Label>
                  <Textarea
                    id="loc-desc"
                    placeholder="Brief description of this location"
                    value={locationData.description}
                    onChange={(e) => setLocationData(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 'item' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                  <Package className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <h3 className="font-semibold">Create Your First Item</h3>
                  <p className="text-sm text-muted-foreground">
                    Add an item to your inventory
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="item-name">Item Name *</Label>
                  <Input
                    id="item-name"
                    placeholder="e.g., Printer Paper, USB Cable"
                    value={itemData.name}
                    onChange={(e) => setItemData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="item-stock">Current Stock</Label>
                    <Input
                      id="item-stock"
                      type="number"
                      min="0"
                      value={itemData.currentStock}
                      onChange={(e) => setItemData(prev => ({ ...prev, currentStock: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="item-min">Min Stock</Label>
                    <Input
                      id="item-min"
                      type="number"
                      min="0"
                      value={itemData.minimumStock}
                      onChange={(e) => setItemData(prev => ({ ...prev, minimumStock: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="item-unit">Unit</Label>
                    <Input
                      id="item-unit"
                      placeholder="pcs"
                      value={itemData.unit}
                      onChange={(e) => setItemData(prev => ({ ...prev, unit: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="item-desc">Description (optional)</Label>
                  <Textarea
                    id="item-desc"
                    placeholder="Brief description of this item"
                    value={itemData.description}
                    onChange={(e) => setItemData(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 'complete' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold">You're All Set!</h3>
              <p className="text-muted-foreground">
                Congratulations! You've created your first category, location, and item.
                You're ready to start managing your inventory.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Badge className="bg-green-500/10 text-green-600">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {categoryData.name}
                </Badge>
                <Badge className="bg-green-500/10 text-green-600">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {locationData.name}
                </Badge>
                <Badge className="bg-green-500/10 text-green-600">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {itemData.name}
                </Badge>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-2">
          {currentStep !== 'welcome' && currentStep !== 'complete' ? (
            <Button variant="outline" onClick={handleBack} disabled={isLoading}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          ) : (
            <div />
          )}
          
          {currentStep === 'welcome' && (
            <Button onClick={handleNext} className="ml-auto">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          
          {currentStep === 'category' && (
            <Button onClick={handleCreateCategory} disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Category'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          
          {currentStep === 'location' && (
            <Button onClick={handleCreateLocation} disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Location'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          
          {currentStep === 'item' && (
            <Button onClick={handleCreateItem} disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Item'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          
          {currentStep === 'complete' && (
            <Button onClick={handleComplete} className="ml-auto">
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

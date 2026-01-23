import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  Plus,
  MapPin,
  Building2,
  DoorOpen,
  Archive,
  Package,
  Inbox,
  ChevronRight,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { Location, LocationType } from '@/types/database';

const LOCATION_TYPES: { value: LocationType; label: string; icon: typeof Building2 }[] = [
  { value: 'building', label: 'Building', icon: Building2 },
  { value: 'room', label: 'Room', icon: DoorOpen },
  { value: 'shelf', label: 'Shelf', icon: Archive },
  { value: 'box', label: 'Box', icon: Package },
  { value: 'drawer', label: 'Drawer', icon: Inbox },
];

export default function Locations() {
  const { canManageInventory } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location_type: '' as LocationType | '',
    parent_id: '',
  });

  useEffect(() => {
    fetchLocations();
  }, []);

  async function fetchLocations() {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('location_type')
        .order('name');

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast.error('Failed to load locations');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      description: '',
      location_type: '',
      parent_id: '',
    });
    setEditingLocation(null);
  }

  function openEditDialog(location: Location) {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      description: location.description || '',
      location_type: location.location_type,
      parent_id: location.parent_id || '',
    });
    setIsDialogOpen(true);
  }

  function getParentOptions(currentType: LocationType | '') {
    if (!currentType) return [];
    const typeIndex = LOCATION_TYPES.findIndex((t) => t.value === currentType);
    if (typeIndex <= 0) return [];

    const allowedTypes = LOCATION_TYPES.slice(0, typeIndex).map((t) => t.value);
    return locations.filter((loc) => allowedTypes.includes(loc.location_type));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.location_type) {
      toast.error('Name and type are required');
      return;
    }

    setSubmitting(true);
    try {
      if (editingLocation) {
        const { error } = await supabase
          .from('locations')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            location_type: formData.location_type,
            parent_id: formData.parent_id || null,
          })
          .eq('id', editingLocation.id);

        if (error) throw error;
        toast.success('Location updated successfully');
      } else {
        const { data: codeData } = await supabase.rpc('generate_location_code', {
          _type: formData.location_type,
        });

        const { error } = await supabase.from('locations').insert({
          code: codeData || `YIMS:${formData.location_type.toUpperCase()}:${Date.now()}`,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          location_type: formData.location_type,
          parent_id: formData.parent_id || null,
        });

        if (error) throw error;
        toast.success('Location created successfully');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchLocations();
    } catch (error: unknown) {
      console.error('Error saving location:', error);
      toast.error((error as Error).message || 'Failed to save location');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(location: Location) {
    if (!confirm(`Are you sure you want to delete "${location.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('locations')
        .update({ is_active: false })
        .eq('id', location.id);

      if (error) throw error;
      toast.success('Location deleted successfully');
      fetchLocations();
    } catch (error) {
      console.error('Error deleting location:', error);
      toast.error('Failed to delete location');
    }
  }

  function toggleExpand(locationId: string) {
    setExpandedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(locationId)) {
        next.delete(locationId);
      } else {
        next.add(locationId);
      }
      return next;
    });
  }

  // Build tree structure
  function buildTree(parentId: string | null = null): Location[] {
    return locations
      .filter((loc) => loc.parent_id === parentId)
      .map((loc) => ({
        ...loc,
        children: buildTree(loc.id),
      }));
  }

  function getLocationIcon(type: LocationType) {
    const found = LOCATION_TYPES.find((t) => t.value === type);
    const Icon = found?.icon || MapPin;
    return <Icon className="h-4 w-4" />;
  }

  function renderLocationTree(locs: Location[], depth = 0): JSX.Element[] {
    return locs.flatMap((location) => {
      const children = (location as Location & { children?: Location[] }).children || [];
      const hasChildren = children.length > 0;
      const isExpanded = expandedLocations.has(location.id);

      return [
        <div
          key={location.id}
          className="flex items-center gap-2 rounded-lg border p-3 hover:bg-muted/50"
          style={{ marginLeft: depth * 24 }}
        >
          {hasChildren ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => toggleExpand(location.id)}
            >
              <ChevronRight
                className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
            </Button>
          ) : (
            <div className="w-6" />
          )}
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            {getLocationIcon(location.location_type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{location.name}</div>
            <div className="text-xs text-muted-foreground font-mono">{location.code}</div>
          </div>
          <Badge variant="secondary" className="capitalize">
            {location.location_type}
          </Badge>
          {canManageInventory && (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => openEditDialog(location)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(location)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>,
        ...(isExpanded ? renderLocationTree(children, depth + 1) : []),
      ];
    });
  }

  const tree = buildTree();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
          <p className="text-muted-foreground">Manage storage locations hierarchy</p>
        </div>
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
                Add Location
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingLocation ? 'Edit Location' : 'Add New Location'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingLocation
                      ? 'Update the location details below.'
                      : 'Create a new storage location.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="location_type">Type *</Label>
                    <Select
                      value={formData.location_type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, location_type: value as LocationType, parent_id: '' })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location type" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCATION_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className="h-4 w-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter location name"
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
                  {formData.location_type && formData.location_type !== 'building' && (
                    <div className="grid gap-2">
                      <Label htmlFor="parent">Parent Location</Label>
                      <Select
                        value={formData.parent_id}
                        onValueChange={(value) => setFormData({ ...formData, parent_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select parent location" />
                        </SelectTrigger>
                        <SelectContent>
                          {getParentOptions(formData.location_type).map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.name} ({loc.location_type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingLocation ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location Hierarchy
            <Badge variant="secondary" className="ml-2">
              {locations.length}
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
          ) : locations.length === 0 ? (
            <div className="py-12 text-center">
              <MapPin className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-medium">No locations found</h3>
              <p className="text-muted-foreground">
                Start by adding your first location (e.g., a building)
              </p>
            </div>
          ) : (
            <div className="space-y-2">{renderLocationTree(tree)}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeatureToggles, type FeatureKey } from '@/hooks/useFeatureToggles';
import { toast } from 'sonner';
import { 
  Command, 
  History, 
  Zap, 
  Users, 
  BarChart3, 
  Camera, 
  Undo2, 
  Keyboard, 
  Hand 
} from 'lucide-react';

const TOGGLE_ICONS: Record<FeatureKey, React.ElementType> = {
  command_palette: Command,
  time_travel_view: History,
  fast_text_parser: Zap,
  live_presence: Users,
  analytics_panel: BarChart3,
  camera_qr: Camera,
  undo_transactions: Undo2,
  keyboard_first_mode: Keyboard,
  glove_friendly_mode: Hand,
};

interface FeatureTogglesSectionProps {
  disabled?: boolean;
}

export function FeatureTogglesSection({ disabled = false }: FeatureTogglesSectionProps) {
  const { toggles, loading, setToggle } = useFeatureToggles();

  const handleToggle = async (key: FeatureKey, enabled: boolean) => {
    const result = await setToggle(key, enabled);
    if (result.success) {
      toast.success(`${enabled ? 'Enabled' : 'Disabled'} ${key.replace(/_/g, ' ')}`);
    } else {
      toast.error(result.error || 'Failed to update toggle');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Feature Toggles</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Group toggles by category
  const uxToggles = toggles.filter(t => t.category === 'ux');
  const experimentalToggles = toggles.filter(t => t.category === 'experimental');

  const renderToggle = (toggle: typeof toggles[0]) => {
    const Icon = TOGGLE_ICONS[toggle.key as FeatureKey] || Zap;
    
    return (
      <div 
        key={toggle.key}
        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <Label 
              htmlFor={toggle.key} 
              className="text-sm font-medium cursor-pointer"
            >
              {toggle.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Label>
            <p className="text-xs text-muted-foreground">{toggle.description}</p>
          </div>
        </div>
        <Switch
          id={toggle.key}
          checked={toggle.enabled}
          onCheckedChange={(checked) => handleToggle(toggle.key as FeatureKey, checked)}
          disabled={disabled}
        />
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Feature Toggles</CardTitle>
            <CardDescription>
              Enable or disable experimental features. All toggles are OFF by default.
            </CardDescription>
          </div>
          <Badge variant="secondary">
            {toggles.filter(t => t.enabled).length} / {toggles.length} enabled
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* UX Features */}
        {uxToggles.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              UX Features
            </h4>
            <div className="space-y-2">
              {uxToggles.map(renderToggle)}
            </div>
          </div>
        )}

        {/* Experimental Features */}
        {experimentalToggles.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              Experimental
              <Badge variant="warning" className="text-[10px]">Beta</Badge>
            </h4>
            <div className="space-y-2">
              {experimentalToggles.map(renderToggle)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

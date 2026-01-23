import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { 
  useSystemPolicies, 
  type NegativeStockPolicy, 
  type RequireReasonPolicy,
  type UndoSettingsPolicy,
  type ConfirmationThresholdsPolicy 
} from '@/hooks/useSystemPolicies';
import { toast } from 'sonner';
import { AlertTriangle, Save, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SystemPoliciesSectionProps {
  disabled?: boolean;
}

export function SystemPoliciesSection({ disabled = false }: SystemPoliciesSectionProps) {
  const { 
    loading, 
    negativeStockPolicy, 
    requireReasonPolicy, 
    undoSettingsPolicy,
    confirmationThresholds,
    updatePolicy 
  } = useSystemPolicies();

  const [negativeStock, setNegativeStock] = useState<NegativeStockPolicy>({
    allowed: true,
    max_threshold: -100,
    auto_resolve: true,
  });

  const [requireReason, setRequireReason] = useState<RequireReasonPolicy>({
    issue: true,
    consume: true,
    adjust: false,
    return: false,
  });

  const [undoSettings, setUndoSettings] = useState<UndoSettingsPolicy>({
    enabled: false,
    window_minutes: 15,
  });

  const [thresholds, setThresholds] = useState<ConfirmationThresholdsPolicy>({
    stock_out: 50,
    adjust: 100,
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load initial values
  useEffect(() => {
    if (negativeStockPolicy) setNegativeStock(negativeStockPolicy);
    if (requireReasonPolicy) setRequireReason(requireReasonPolicy);
    if (undoSettingsPolicy) setUndoSettings(undoSettingsPolicy);
    if (confirmationThresholds) setThresholds(confirmationThresholds);
  }, [negativeStockPolicy, requireReasonPolicy, undoSettingsPolicy, confirmationThresholds]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const results = await Promise.all([
        updatePolicy('negative_stock', negativeStock as unknown as Record<string, unknown>),
        updatePolicy('require_reason', requireReason as unknown as Record<string, unknown>),
        updatePolicy('undo_settings', undoSettings as unknown as Record<string, unknown>),
        updatePolicy('confirmation_thresholds', thresholds as unknown as Record<string, unknown>),
      ]);

      const allSuccess = results.every(r => r.success);
      if (allSuccess) {
        toast.success('System policies saved successfully');
        setHasChanges(false);
      } else {
        const errors = results.filter(r => !r.success).map(r => r.error);
        toast.error(`Failed to save some policies: ${errors.join(', ')}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (negativeStockPolicy) setNegativeStock(negativeStockPolicy);
    if (requireReasonPolicy) setRequireReason(requireReasonPolicy);
    if (undoSettingsPolicy) setUndoSettings(undoSettingsPolicy);
    if (confirmationThresholds) setThresholds(confirmationThresholds);
    setHasChanges(false);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Policies</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>System Policies</CardTitle>
            <CardDescription>
              Configure inventory rules and operation requirements
            </CardDescription>
          </div>
          {hasChanges && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Negative Stock Policy */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold">Negative Stock Handling</h4>
          
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="allow-negative">Allow Negative Stock</Label>
              <p className="text-xs text-muted-foreground">
                Allow stock to go below zero (over-issue)
              </p>
            </div>
            <Switch
              id="allow-negative"
              checked={negativeStock.allowed}
              onCheckedChange={(checked) => {
                setNegativeStock({ ...negativeStock, allowed: checked });
                setHasChanges(true);
              }}
              disabled={disabled}
            />
          </div>

          {negativeStock.allowed && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="max-threshold">Maximum Negative Threshold</Label>
                <Input
                  id="max-threshold"
                  type="number"
                  max="0"
                  value={negativeStock.max_threshold}
                  onChange={(e) => {
                    setNegativeStock({ ...negativeStock, max_threshold: parseInt(e.target.value) || -100 });
                    setHasChanges(true);
                  }}
                  disabled={disabled}
                />
                <p className="text-xs text-muted-foreground">
                  Stock cannot go below this value (e.g., -100)
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-resolve">Auto-resolve on Restock</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically clear negative balance when restocking
                  </p>
                </div>
                <Switch
                  id="auto-resolve"
                  checked={negativeStock.auto_resolve}
                  onCheckedChange={(checked) => {
                    setNegativeStock({ ...negativeStock, auto_resolve: checked });
                    setHasChanges(true);
                  }}
                  disabled={disabled}
                />
              </div>
            </>
          )}
        </div>

        <Separator />

        {/* Require Reason Policy */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold">Require Reason/Notes</h4>
          <p className="text-xs text-muted-foreground">
            Make notes mandatory for specific actions
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            {(['issue', 'return', 'adjust', 'consume'] as const).map((action) => (
              <div key={action} className="flex items-center justify-between p-3 border rounded-lg">
                <Label htmlFor={`require-${action}`} className="capitalize">
                  {action}
                </Label>
                <Switch
                  id={`require-${action}`}
                  checked={requireReason[action]}
                  onCheckedChange={(checked) => {
                    setRequireReason({ ...requireReason, [action]: checked });
                    setHasChanges(true);
                  }}
                  disabled={disabled}
                />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Confirmation Thresholds */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold">Confirmation Thresholds</h4>
          <p className="text-xs text-muted-foreground">
            Require admin approval for operations exceeding these quantities
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="threshold-stockout">Stock Out / Issue</Label>
              <Input
                id="threshold-stockout"
                type="number"
                min="0"
                value={thresholds.stock_out}
                onChange={(e) => {
                  setThresholds({ ...thresholds, stock_out: parseInt(e.target.value) || 0 });
                  setHasChanges(true);
                }}
                disabled={disabled}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="threshold-adjust">Adjustments</Label>
              <Input
                id="threshold-adjust"
                type="number"
                min="0"
                value={thresholds.adjust}
                onChange={(e) => {
                  setThresholds({ ...thresholds, adjust: parseInt(e.target.value) || 0 });
                  setHasChanges(true);
                }}
                disabled={disabled}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Set to 0 to disable approval requirement
          </p>
        </div>

        <Separator />

        {/* Undo Settings */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold">Undo Transactions</h4>
          
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enable-undo">Enable Undo</Label>
              <p className="text-xs text-muted-foreground">
                Allow users to undo recent transactions
              </p>
            </div>
            <Switch
              id="enable-undo"
              checked={undoSettings.enabled}
              onCheckedChange={(checked) => {
                setUndoSettings({ ...undoSettings, enabled: checked });
                setHasChanges(true);
              }}
              disabled={disabled}
            />
          </div>

          {undoSettings.enabled && (
            <div className="grid gap-2">
              <Label htmlFor="undo-window">Undo Window (minutes)</Label>
              <Input
                id="undo-window"
                type="number"
                min="1"
                max="60"
                value={undoSettings.window_minutes}
                onChange={(e) => {
                  setUndoSettings({ ...undoSettings, window_minutes: parseInt(e.target.value) || 15 });
                  setHasChanges(true);
                }}
                disabled={disabled}
              />
              <p className="text-xs text-muted-foreground">
                Transactions can only be undone within this time window
              </p>
            </div>
          )}

          {undoSettings.enabled && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Undo creates a compensating (reverse) transaction. The original log entry remains immutable.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

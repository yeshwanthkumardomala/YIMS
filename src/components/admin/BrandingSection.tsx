import React, { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useBranding } from '@/hooks/useBranding';
import { toast } from 'sonner';
import { Upload, Trash2, RotateCcw, Image as ImageIcon, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface BrandingSectionProps {
  disabled?: boolean;
}

export function BrandingSection({ disabled = false }: BrandingSectionProps) {
  const { branding, loading, updateBranding, uploadLogo, uploadFavicon, resetToDefault } = useBranding();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  
  const [uploading, setUploading] = useState<'logo' | 'favicon' | null>(null);
  const [localName, setLocalName] = useState('');
  const [localTagline, setLocalTagline] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync local state with branding
  React.useEffect(() => {
    if (branding) {
      setLocalName(branding.app_name);
      setLocalTagline(branding.tagline || '');
    }
  }, [branding]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setUploading('logo');
    const result = await uploadLogo(file);
    setUploading(null);

    if (result.success) {
      toast.success('Logo uploaded successfully');
    } else {
      toast.error(result.error || 'Failed to upload logo');
    }

    // Reset input
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 500KB)
    if (file.size > 500 * 1024) {
      toast.error('Favicon must be less than 500KB');
      return;
    }

    setUploading('favicon');
    const result = await uploadFavicon(file);
    setUploading(null);

    if (result.success) {
      toast.success('Favicon uploaded successfully');
    } else {
      toast.error(result.error || 'Failed to upload favicon');
    }

    // Reset input
    if (faviconInputRef.current) faviconInputRef.current.value = '';
  };

  const handleSaveText = async () => {
    setSaving(true);
    const result = await updateBranding({
      app_name: localName.trim() || 'YIMS',
      tagline: localTagline.trim() || null,
    });
    setSaving(false);

    if (result.success) {
      toast.success('Branding updated successfully');
    } else {
      toast.error(result.error || 'Failed to update branding');
    }
  };

  const handleReset = async () => {
    const result = await resetToDefault();
    if (result.success) {
      toast.success('Branding reset to default');
    } else {
      toast.error(result.error || 'Failed to reset branding');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Branding & Appearance</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasTextChanges = 
    localName !== branding?.app_name || 
    localTagline !== (branding?.tagline || '');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Branding & Appearance</CardTitle>
            <CardDescription>
              Customize your system's logo and identity. Version {branding?.version || 1}
            </CardDescription>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={disabled}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset to Default
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Branding?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove your custom logo and favicon, and reset the app name to "YIMS".
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo Upload */}
        <div className="space-y-3">
          <Label>System Logo</Label>
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/50 overflow-hidden">
              {branding?.logo_url ? (
                <img 
                  src={branding.logo_url} 
                  alt="Logo" 
                  className="h-full w-full object-contain"
                />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={disabled || uploading !== null}
              />
              <Button
                variant="outline"
                onClick={() => logoInputRef.current?.click()}
                disabled={disabled || uploading !== null}
              >
                {uploading === 'logo' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload Logo
              </Button>
              <p className="text-xs text-muted-foreground">
                Recommended: 200x200px, PNG or SVG, max 2MB
              </p>
            </div>
          </div>
        </div>

        {/* Favicon Upload */}
        <div className="space-y-3">
          <Label>Favicon / App Icon</Label>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/50 overflow-hidden">
              {branding?.favicon_url ? (
                <img 
                  src={branding.favicon_url} 
                  alt="Favicon" 
                  className="h-full w-full object-contain"
                />
              ) : (
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={faviconInputRef}
                type="file"
                accept="image/*"
                onChange={handleFaviconUpload}
                className="hidden"
                disabled={disabled || uploading !== null}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => faviconInputRef.current?.click()}
                disabled={disabled || uploading !== null}
              >
                {uploading === 'favicon' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload Favicon
              </Button>
              <p className="text-xs text-muted-foreground">
                Recommended: 32x32px or 64x64px, max 500KB
              </p>
            </div>
          </div>
        </div>

        {/* App Name & Tagline */}
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="app-name">Application Name</Label>
            <Input
              id="app-name"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              placeholder="YIMS"
              disabled={disabled}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={localTagline}
              onChange={(e) => setLocalTagline(e.target.value)}
              placeholder="Yesh Inventory Management System"
              disabled={disabled}
            />
          </div>
          {hasTextChanges && (
            <Button onClick={handleSaveText} disabled={saving || disabled}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Shield, Copy, Check, AlertTriangle } from 'lucide-react';

interface TwoFactorSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function TwoFactorSetup({ onComplete, onCancel }: TwoFactorSetupProps) {
  const [step, setStep] = useState<'generate' | 'verify' | 'backup'>('generate');
  const [loading, setLoading] = useState(false);
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [backupCopied, setBackupCopied] = useState(false);

  async function generateSecret() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in again');
        return;
      }

      const response = await supabase.functions.invoke('generate-totp-secret', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const { secret, otpauthUrl, backupCodes } = response.data;
      setSecret(secret);
      setOtpauthUrl(otpauthUrl);
      setBackupCodes(backupCodes);
      setStep('verify');
    } catch (error) {
      console.error('Error generating secret:', error);
      toast.error('Failed to generate 2FA secret');
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in again');
        return;
      }

      const response = await supabase.functions.invoke('verify-totp', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { code: verificationCode, isSetup: true },
      });

      if (response.error || !response.data.valid) {
        toast.error('Invalid verification code');
        return;
      }

      toast.success('2FA enabled successfully!');
      setStep('backup');
    } catch (error) {
      console.error('Error verifying code:', error);
      toast.error('Failed to verify code');
    } finally {
      setLoading(false);
    }
  }

  function copySecret() {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Secret copied to clipboard');
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setBackupCopied(true);
    setTimeout(() => setBackupCopied(false), 2000);
    toast.success('Backup codes copied to clipboard');
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Set Up Two-Factor Authentication</CardTitle>
        </div>
        <CardDescription>
          {step === 'generate' && 'Add an extra layer of security to your account'}
          {step === 'verify' && 'Scan the QR code with your authenticator app'}
          {step === 'backup' && 'Save your backup codes in a secure location'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'generate' && (
          <>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You'll need an authenticator app like Google Authenticator, Authy, or 1Password.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button onClick={generateSecret} disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Get Started'
                )}
              </Button>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </>
        )}

        {step === 'verify' && (
          <>
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <QRCodeSVG value={otpauthUrl} size={200} />
            </div>

            <div className="space-y-2">
              <Label>Or enter this secret manually:</Label>
              <div className="flex gap-2">
                <Input value={secret} readOnly className="font-mono text-sm" />
                <Button variant="outline" size="icon" onClick={copySecret}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verification-code">Enter the 6-digit code from your app:</Label>
              <Input
                id="verification-code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={verifyCode} disabled={loading || verificationCode.length !== 6} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Enable'
                )}
              </Button>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </>
        )}

        {step === 'backup' && (
          <>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Save these backup codes now! They won't be shown again. Use them if you lose access to your authenticator.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
              {backupCodes.map((code, i) => (
                <Badge key={i} variant="secondary" className="justify-center py-2">
                  {code}
                </Badge>
              ))}
            </div>

            <Button variant="outline" onClick={copyBackupCodes} className="w-full">
              {backupCopied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Backup Codes
                </>
              )}
            </Button>

            <Button onClick={onComplete} className="w-full">
              I've Saved My Backup Codes
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

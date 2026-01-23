import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, Shield, AlertTriangle } from 'lucide-react';

interface TwoFactorVerifyProps {
  onVerified: () => void;
  onCancel: () => void;
}

export function TwoFactorVerify({ onVerified, onCancel }: TwoFactorVerifyProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showBackupInput, setShowBackupInput] = useState(false);
  const [backupCode, setBackupCode] = useState('');

  async function verifyCode() {
    const verifyValue = showBackupInput ? backupCode : code;
    
    if (!showBackupInput && verifyValue.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    if (showBackupInput && verifyValue.length !== 8) {
      setError('Please enter your 8-character backup code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session expired. Please sign in again.');
        onCancel();
        return;
      }

      const response = await supabase.functions.invoke('verify-totp', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { code: verifyValue, isSetup: false },
      });

      if (response.error || !response.data.valid) {
        setError(showBackupInput ? 'Invalid backup code' : 'Invalid verification code');
        return;
      }

      if (response.data.usedBackupCode) {
        toast.info(`Backup code used. ${response.data.remainingBackupCodes} codes remaining.`);
      }

      onVerified();
    } catch (error) {
      console.error('Error verifying code:', error);
      setError('Failed to verify code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <div className="p-3 rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
        </div>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>
          {showBackupInput 
            ? 'Enter one of your backup codes'
            : 'Enter the code from your authenticator app'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!showBackupInput ? (
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={(value) => {
                setCode(value);
                setError('');
              }}
              onComplete={verifyCode}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
        ) : (
          <input
            type="text"
            value={backupCode}
            onChange={(e) => {
              setBackupCode(e.target.value.toUpperCase().slice(0, 8));
              setError('');
            }}
            placeholder="XXXXXXXX"
            className="w-full text-center text-2xl tracking-widest font-mono p-3 border rounded-md"
            maxLength={8}
          />
        )}

        <div className="flex gap-2">
          <Button 
            onClick={verifyCode} 
            disabled={loading || (!showBackupInput && code.length !== 6) || (showBackupInput && backupCode.length !== 8)} 
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify'
            )}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>

        <Button
          variant="link"
          onClick={() => {
            setShowBackupInput(!showBackupInput);
            setError('');
            setCode('');
            setBackupCode('');
          }}
          className="w-full"
        >
          {showBackupInput ? 'Use authenticator code instead' : 'Use a backup code'}
        </Button>
      </CardContent>
    </Card>
  );
}

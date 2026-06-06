'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Contains number', met: /[0-9]/.test(password) },
    { label: 'Contains special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const score = checks.filter((c) => c.met).length;
  const strength = score <= 1 ? 'Weak' : score <= 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong';
  const colorClass =
    score <= 1 ? 'bg-red-500' : score <= 2 ? 'bg-amber-500' : score === 3 ? 'bg-blue-500' : 'bg-emerald-500';

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Password strength</span>
        <span className={`text-xs font-medium ${score <= 1 ? 'text-red-500' : score <= 2 ? 'text-amber-500' : score === 3 ? 'text-blue-500' : 'text-emerald-500'}`}>
          {strength}
        </span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? colorClass : 'bg-muted'}`}
          />
        ))}
      </div>
      <div className="space-y-1 mt-2">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center gap-2">
            {check.met ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-3 h-3 text-muted-foreground/40 shrink-0" />
            )}
            <span className={`text-xs ${check.met ? 'text-foreground' : 'text-muted-foreground/60'}`}>
              {check.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  const { isAuthenticated, isLoading, mustChangePassword, logout } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error('Password must contain at least one uppercase letter and one number');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await authApi.changePassword(currentPassword, newPassword);
      if (error) {
        toast.error('Failed to change password', { description: error });
      } else {
        toast.success('Password changed! Please log in again.');
        await logout();
        router.replace('/login');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-[440px] mx-4 animate-fade-in relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-5">
            <Shield className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Change Your Password
          </h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {mustChangePassword
              ? 'For security, you must set a new password before continuing.'
              : 'Update your account password below.'}
          </p>
        </div>

        {mustChangePassword && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>This is a first-time login. You must change the default password to continue.</span>
          </div>
        )}

        <Card className="border border-border/60 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-2 pt-6 px-6">
            <h2 className="text-base font-semibold">Set New Password</h2>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-sm font-medium">
                  Current Password
                </Label>
                <Input
                  id="current-password"
                  type="password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 bg-background/80"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm font-medium">
                  New Password
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-11 bg-background/80"
                />
                {newPassword && <PasswordStrength password={newPassword} />}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-medium">
                  Confirm New Password
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={`h-11 bg-background/80 ${confirmPassword && newPassword !== confirmPassword ? 'border-destructive' : ''}`}
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Passwords do not match
                  </p>
                )}
              </div>

              <Button
                id="submit-change-password"
                type="submit"
                className="w-full h-11 mt-2 font-semibold text-sm"
                disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Updating Password...
                  </div>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Update Password
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Protected by Nova Central Security
        </p>
      </div>
    </div>
  );
}

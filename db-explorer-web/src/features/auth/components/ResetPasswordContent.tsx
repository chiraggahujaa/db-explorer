'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../hooks/useAuth';
import { setNewPasswordSchema } from '../validations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { toast } from 'sonner';

type ResetPasswordFormData = {
  newPassword: string;
  confirmPassword: string;
};

export default function ResetPasswordContent() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const router = useRouter();
  const { updatePasswordWithToken, isUpdatingPassword } = useAuth();

  useEffect(() => {
    // Parse hash parameters on client side
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      
      // Check for access_token in hash or token in query params
      const accessToken = params.get('access_token');
      const tokenParam = new URLSearchParams(window.location.search).get('token');
      const recoveryType = params.get('type') || new URLSearchParams(window.location.search).get('type');
      
      setToken(accessToken || tokenParam);
      setType(recoveryType);
    }
  }, []);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(setNewPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      toast.error('No reset token found');
      return;
    }

    try {
      // Use the new updatePasswordWithToken function that passes the token in headers
      const result = await updatePasswordWithToken(data.newPassword, token);
      
      if (result.success) {
        setIsSuccess(true);
        toast.success(result.message || 'Password updated successfully!');
      } else {
        toast.error(result.message || 'Failed to update password');
      }
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } } };
      toast.error(anyErr?.response?.data?.error || 'Failed to update password');
      console.error('Password reset error:', err);
    }
  };

  if (!token || type !== 'recovery') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Invalid Reset Link</CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/signin')} className="w-full">
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-green-600">Password Updated!</CardTitle>
            <CardDescription>
              Your password has been successfully updated. You can now sign in with your new password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/signin')} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Reset Password</CardTitle>
          <CardDescription className="text-center">Enter your new password below</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="newPassword" type={showPassword ? 'text' : 'password'} placeholder="Enter your new password" className="pl-10 pr-10" {...form.register('newPassword')} />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {form.formState.errors.newPassword && (
                <p className="text-sm text-destructive">{form.formState.errors.newPassword.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirm your new password" className="pl-10 pr-10" {...form.register('confirmPassword')} />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {form.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isUpdatingPassword}>
              {isUpdatingPassword ? 'Updating Password...' : 'Update Password'}
            </Button>
          </form>
          <div className="text-center">
            <Button variant="link" className="text-sm" onClick={() => router.push('/signin')}>
              Back to Sign In
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



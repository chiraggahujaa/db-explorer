'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, Lock, Shield, Mail, Key } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { toast } from 'sonner';
import { ApiError } from '@/types/api';
import { changePasswordSchema, resetPasswordSchema } from '../../validations/security';
import { ChangePasswordFormData, ResetPasswordFormData } from '../../types/security';

export function SecurityTab() {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeSection, setActiveSection] = useState<'change' | 'reset'>('change');

  const { updatePassword, resetPassword, isUpdatingPassword, isResettingPassword, user } = useAuth();

  // Change password form
  const changePasswordForm = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  // Reset password form
  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: user?.email || '',
    },
  });

  const onChangePassword = async (data: ChangePasswordFormData) => {
    try {
      await updatePassword(data.newPassword, data.currentPassword);
      changePasswordForm.reset();
      toast.success('Password changed successfully!');
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as ApiError).response?.data?.error
        : 'Failed to change password';
      toast.error(message);
    }
  };

  const onRequestPasswordReset = async (data: ResetPasswordFormData) => {
    try {
      await resetPassword(data.email);
      toast.success('Password reset email sent! Check your inbox.');
    } catch (error: unknown) {
      const message = error instanceof Error && 'response' in error
        ? (error as ApiError).response?.data?.error
        : 'Failed to send reset email';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Security Settings</h1>
        <p className="text-muted-foreground">
          Manage your password and security preferences
        </p>
      </div>

      {/* Security Options */}
      <div className="flex gap-2 border-b">
        <Button
          variant={activeSection === 'change' ? 'default' : 'ghost'}
          onClick={() => setActiveSection('change')}
          className="rounded-b-none"
        >
          <Key className="h-4 w-4 mr-2" />
          Change Password
        </Button>
        <Button
          variant={activeSection === 'reset' ? 'default' : 'ghost'}
          onClick={() => setActiveSection('reset')}
          className="rounded-b-none"
        >
          <Mail className="h-4 w-4 mr-2" />
          Reset Password
        </Button>
      </div>

      {activeSection === 'change' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Change Password
            </CardTitle>
            <CardDescription>
              Update your password to keep your account secure. Make sure to use a strong password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePasswordForm.handleSubmit(onChangePassword)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    placeholder="Enter your current password"
                    className="pl-10 pr-10"
                    {...changePasswordForm.register('currentPassword')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {changePasswordForm.formState.errors.currentPassword && (
                  <p className="text-sm text-destructive">
                    {changePasswordForm.formState.errors.currentPassword.message}
                  </p>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Enter your new password"
                    className="pl-10 pr-10"
                    {...changePasswordForm.register('newPassword')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {changePasswordForm.formState.errors.newPassword && (
                  <p className="text-sm text-destructive">
                    {changePasswordForm.formState.errors.newPassword.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your new password"
                    className="pl-10 pr-10"
                    {...changePasswordForm.register('confirmPassword')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {changePasswordForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">
                    {changePasswordForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <div className="pt-4">
                <Button type="submit" disabled={isUpdatingPassword} className="w-full sm:w-auto">
                  {isUpdatingPassword ? 'Changing Password...' : 'Change Password'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {activeSection === 'reset' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Request Password Reset
            </CardTitle>
            <CardDescription>
              Send a password reset link to your email. This is useful if you&#39;ve forgotten your current password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={resetPasswordForm.handleSubmit(onRequestPasswordReset)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resetEmail">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="resetEmail"
                    type="email"
                    placeholder="Enter your email address"
                    className="pl-10"
                    {...resetPasswordForm.register('email')}
                  />
                </div>
                {resetPasswordForm.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {resetPasswordForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-800">Security Note</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      A password reset link will be sent to your email. The link will expire in 1 hour for security purposes.
                      You can use this link to set a new password without knowing your current one.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button type="submit" disabled={isResettingPassword} variant="outline" className="w-full sm:w-auto">
                  {isResettingPassword ? 'Sending Reset Email...' : 'Send Reset Email'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
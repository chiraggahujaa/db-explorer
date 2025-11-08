'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../hooks/useAuth';
import type { SignInFormData, ForgotPasswordFormData } from '@/types/forms';
import { loginSchema, forgotPasswordSchema } from '../validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { toast } from 'sonner';

// moved to '@/types'

export function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { 
    login, 
    resetPassword, 
    isLoggingIn, 
    isResettingPassword
  } = useAuth();

  // Email/Password form
  const emailForm = useForm<SignInFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Forgot password form
  const forgotPasswordForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onEmailSubmit = async (data: SignInFormData) => {
    try {
      await login(data.email, data.password);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const onForgotPasswordSubmit = async (data: ForgotPasswordFormData) => {
    try {
      await resetPassword(data.email);
    } catch (error) {
      console.error('Reset password error:', error);
    }
  };

  const { googleAuth, githubAuth, isGitHubAuthenticating } = useAuth();
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  
  const handleGoogleCredential = (credential: string) => {
    googleAuth({ accessToken: '', idToken: credential });
  };

  const handleGoogleError = () => {
    // Suppress console error in development if client ID is not configured
    if (!googleClientId) {
      console.warn('Google OAuth is not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID in your .env.local file.');
      return;
    }
    toast.error('Google sign-in failed. Please check your Google OAuth configuration.');
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          {showForgotPassword ? 'Reset Password' : 'Sign In'}
        </CardTitle>
        <CardDescription className="text-center">
          {showForgotPassword 
            ? 'Enter your email address and we\'ll send you a link to reset your password'
            : 'Choose your preferred sign in method'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showForgotPassword ? (
          <>
            {/* Sign In Form */}
            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    className="pl-10"
                    {...emailForm.register('email')}
                  />
                </div>
                {emailForm.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {emailForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className="pl-10 pr-10"
                    {...emailForm.register('password')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {emailForm.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {emailForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            {/* Forgot Password Link */}
            <div className="text-center">
              <Button
                variant="link"
                className="text-sm"
                onClick={() => setShowForgotPassword(true)}
              >
                Forgot your password?
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Forgot Password Form */}
            <form onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="Enter your email"
                    className="pl-10"
                    {...forgotPasswordForm.register('email')}
                  />
                </div>
                {forgotPasswordForm.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {forgotPasswordForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={isResettingPassword}>
                  {isResettingPassword ? 'Sending...' : 'Send Reset Email'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForgotPassword(false);
                    forgotPasswordForm.reset();
                  }}
                >
                  Back
                </Button>
              </div>
            </form>
          </>
        )}

        {/* Social Login - Only show when not in forgot password mode */}
        {!showForgotPassword && (
          <>
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 items-center">
                {googleClientId ? (
                  <GoogleLogin
                    onSuccess={(cred) => cred.credential && handleGoogleCredential(cred.credential)}
                    onError={handleGoogleError}
                    useOneTap
                  />
                ) : (
                  <div className="text-sm text-muted-foreground p-2">
                    Google Sign-In is not configured
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full max-w-[240px]"
                  onClick={githubAuth}
                  disabled={isGitHubAuthenticating}
                >
                  <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" clipRule="evenodd" />
                  </svg>
                  {isGitHubAuthenticating ? 'Signing in...' : 'Sign in with GitHub'}
                </Button>
              </div>
            </div>

            {/* Sign Up Link */}
            <div className="text-center text-sm">
              Don&apos;t have an account?{' '}
              <Button variant="link" className="p-0 h-auto" asChild>
                <a href="/signup">Sign up</a>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

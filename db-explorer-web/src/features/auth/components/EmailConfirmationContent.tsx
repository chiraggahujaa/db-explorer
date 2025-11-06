'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { authAPI } from '@/lib/api/auth';

export default function EmailConfirmationContent() {
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const email = searchParams.get('email');

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResendEmail = async () => {
    if (!email || isResending || countdown > 0) return;
    
    setIsResending(true);
    try {
      const result = await authAPI.resendVerificationEmail(email);
      if (result.success) {
        toast.success(result.message || 'Verification email sent! Please check your inbox.');
        setCountdown(60); // Reset countdown
      } else {
        toast.error(result.message || 'Failed to resend verification email. Please try again.');
      }
    } catch {
      toast.error('Failed to resend verification email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToSignIn = () => {
    router.push('/signin');
  };

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <p className="text-center text-gray-600">Invalid email confirmation link.</p>
            <Button onClick={handleBackToSignIn} className="mt-4">
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Check Your Email</CardTitle>
          <CardDescription>
            We&apos;ve sent a verification link to your email address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Mail className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-medium text-blue-800">Email sent to:</p>
            </div>
            <p className="text-sm text-blue-700 font-mono bg-white px-2 py-1 rounded">
              {email}
            </p>
          </div>

          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-medium text-gray-900 mb-2">What&apos;s next?</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Check your email inbox (and spam folder)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Click the verification link in the email</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>You&apos;ll be redirected back to continue</span>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 text-center mb-3">
                Didn&apos;t receive the email?
              </p>
              <Button
                variant="outline"
                onClick={handleResendEmail}
                disabled={isResending || countdown > 0}
                className="w-full"
              >
                {isResending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : countdown > 0 ? (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Resend in {countdown}s
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Resend Email
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="text-center pt-4 border-t">
            <p className="text-sm text-gray-600 mb-3">
              Already verified your email?
            </p>
            <Button variant="link" onClick={handleBackToSignIn} className="p-0">
              Sign in to your account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
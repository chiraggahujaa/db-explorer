'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { authAPI } from '@/lib/api/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

// Helper function to parse URL fragments from Supabase
const parseUrlFragment = () => {
  if (typeof window === 'undefined') return null;
  
  const fragment = window.location.hash.substring(1);
  if (!fragment) return null;
  
  const params = new URLSearchParams(fragment);
  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
    type: params.get('type'),
    expires_at: params.get('expires_at'),
    expires_in: params.get('expires_in'),
  };
};

export default function VerifyEmailContent() {
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(0);
  const router = useRouter();
  const { setUser } = useAppStore();
  const { setTokens } = useAppStore();

  useEffect(() => {
    const handleEmailVerification = async () => {
      try {
        const fragmentParams = parseUrlFragment();
        
        if (!fragmentParams?.access_token || !fragmentParams?.type) {
          setVerificationStatus('error');
          setErrorMessage('Invalid verification link. Missing authentication tokens.');
          return;
        }

        if (fragmentParams.type === 'signup' && fragmentParams.access_token && fragmentParams.refresh_token) {
          // Show success message first, then set auth state to prevent RootAuthGuard redirect
          setVerificationStatus('success');
          toast.success('Email verified successfully! You are now logged in.');
          
          // Start countdown
          setCountdown(5);
          
          // Countdown timer
          const countdownInterval = setInterval(() => {
            setCountdown(prev => {
              if (prev <= 1) {
                clearInterval(countdownInterval);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
          
          // Set authentication state and redirect after delay
          setTimeout(async () => {
            clearInterval(countdownInterval);
            try {
              setTokens(fragmentParams.access_token || '', fragmentParams.refresh_token || '');
              
              const profile = await authAPI.getProfile();
              if (profile?.success && profile?.data?.user) {
                const user = profile.data.user;
                setUser({
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  emailConfirmedAt: user.emailConfirmedAt,
                  createdAt: user.createdAt,
                  updatedAt: user.updatedAt,
                });

                // Check if user needs onboarding based on profile completeness
                const userProfile = profile.data.profile;
                const needsOnboarding = !userProfile ||
                  !userProfile.fullName ||
                  !userProfile.phoneNumber ||
                  !userProfile.gender ||
                  !userProfile.dob;

                if (needsOnboarding) {
                  router.push('/onboarding');
                } else {
                  router.push('/');
                }
              } else {
                // If we can't get profile, assume they need onboarding
                router.push('/onboarding');
              }
            } catch (error) {
              console.error('Error setting up authentication:', error);
              // On error, assume they need onboarding
              router.push('/onboarding');
            }
          }, 5000);
        } else {
          setVerificationStatus('error');
          setErrorMessage('Invalid verification type or missing tokens.');
        }
      } catch (error) {
        console.error('Email verification error:', error);
        setVerificationStatus('error');
        setErrorMessage('Email verification failed. Please try again.');
      }
    };

    handleEmailVerification();
  }, [router, setTokens, setUser]);

  const handleRedirect = () => {
    if (verificationStatus === 'success') {
      // For manual redirect, always go to onboarding to ensure user completes profile
      router.push('/onboarding');
    } else {
      router.push('/signin');
    }
  };

  if (verificationStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <LoadingSpinner size={32} />
            <p className="mt-4 text-center text-gray-600">Verifying your email...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {verificationStatus === 'success' ? (
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
          ) : (
            <XCircle className="mx-auto h-12 w-12 text-red-500" />
          )}
          <CardTitle>
            {verificationStatus === 'success' ? 'Email Verified!' : 'Verification Failed'}
          </CardTitle>
          <CardDescription>
            {verificationStatus === 'success' 
              ? countdown > 0 
                ? `Your email has been successfully verified. You can now access your account.`
                : 'Your email has been successfully verified. You can now access your account.'
              : 'We encountered an issue verifying your email.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {verificationStatus === 'success' && countdown > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-center space-x-2">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-blue-700 font-medium">
                    Redirecting to onboarding in {countdown} second{countdown !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div className="mt-2 w-full bg-blue-100 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${((5 - countdown) / 5) * 100}%` }}
                />
              </div>
            </div>
          )}
          {verificationStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-600">{errorMessage}</p>
            </div>
          )}
          <Button onClick={handleRedirect} className="w-full">
            {verificationStatus === 'success' ? 'Complete Setup' : 'Back to Sign In'}
          </Button>
          {verificationStatus === 'error' && (
            <div className="text-center">
              <p className="text-sm text-gray-600">Need help? Contact support or try signing in again.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



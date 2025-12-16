'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { authAPI } from '@/lib/api/auth';
import { useAppStore } from '@/stores/useAppStore';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { handleGitHubCallback } = useAuth();
  const { setTokens, setUser } = useAppStore();
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Handle tokens directly (when Supabase has already exchanged the code)
  const handleGitHubCallbackWithTokens = async (accessToken: string, refreshToken: string) => {
    try {
      // Store tokens first
      setTokens(accessToken, refreshToken);
      
      // Get user profile from backend using the stored token
      const profileResponse = await authAPI.getProfile();
      
      if (profileResponse.success && profileResponse.data?.user) {
        const userData = profileResponse.data.user;
        setUser({
          id: userData.id,
          email: userData.email,
          name: userData.name,
          emailConfirmedAt: userData.emailConfirmedAt,
          createdAt: userData.createdAt,
          updatedAt: userData.updatedAt,
        });
        
        // Check if user needs onboarding
        const needsOnboardingCheck = !userData.name || !profileResponse.data.profile?.phone;
        if (needsOnboardingCheck) {
          router.push('/onboarding');
        } else {
          router.push('/');
        }
      } else {
        throw new Error('Failed to get user profile');
      }
    } catch (error) {
      console.error('Token-based callback error:', error);
      setError('Failed to complete authentication. Please try again.');
      setTimeout(() => {
        router.push('/signin');
      }, 3000);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check for errors first
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Check URL hash for errors
    const hash = window.location.hash;
    let hashError = null;
    let hashErrorDescription = null;
    
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1));
      hashError = hashParams.get('error');
      hashErrorDescription = hashParams.get('error_description');
    }

    if (errorParam || hashError) {
      setError(hashErrorDescription || errorDescription || hashError || errorParam);
      setTimeout(() => {
        router.push('/signin');
      }, 3000);
      return;
    }

    // Supabase returns tokens in the hash, not a code
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      if (accessToken && refreshToken) {
        console.log('Found tokens in hash, processing GitHub OAuth callback');
        // Extract the code from the hash if present, otherwise use tokens directly
        const code = hashParams.get('code');
        
        if (code) {
          // If there's a code, use the existing flow
          handleGitHubCallback(code);
        } else {
          // Supabase has already exchanged the code, so we need to handle tokens directly
          // Call backend to process the session
          handleGitHubCallbackWithTokens(accessToken, refreshToken);
        }
        return;
      }
    }

    // Check for code in query params (fallback)
    const code = searchParams.get('code');
    if (code) {
      console.log('Found code in query params, calling handleGitHubCallback');
      handleGitHubCallback(code);
      return;
    }

    // If no tokens or code found, show error
    console.error('No authorization tokens or code found in URL');
    setError('No authorization tokens received. Please try signing in again.');
    setTimeout(() => {
      router.push('/signin');
    }, 3000);
  }, [searchParams, handleGitHubCallback, handleGitHubCallbackWithTokens, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 dark:from-background dark:via-background dark:to-muted/10 p-4">
        <div className="text-center max-w-2xl">
          <h1 className="text-2xl font-bold text-destructive mb-4">Authentication Error</h1>
          <p className="text-foreground mb-4">{error}</p>
          {process.env.NODE_ENV === 'development' && debugInfo && (
            <div className="mt-4 p-4 bg-muted rounded text-left text-xs overflow-auto max-h-64">
              <pre className="whitespace-pre-wrap text-muted-foreground">{debugInfo}</pre>
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-4">Redirecting to sign in page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 dark:from-background dark:via-background dark:to-muted/10 p-4">
      <div className="text-center">
        <LoadingSpinner />
        <p className="mt-4 text-foreground">Completing authentication...</p>
      </div>
    </div>
  );
}


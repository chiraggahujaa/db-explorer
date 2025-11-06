'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';
import { getRouteType, isProtectedRoute } from '@/lib/utils/route-utils';

interface RootAuthGuardProps {
  children: React.ReactNode;
}

export function RootAuthGuard({ children }: RootAuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirected = useRef(false);

  useEffect(() => {
    hasRedirected.current = false;
  }, [pathname]);

  useEffect(() => {
    if (isLoading || hasRedirected.current) {
      return;
    }

    const routeType = getRouteType(pathname);

    if (!isAuthenticated && routeType === 'private') {
      hasRedirected.current = true;
      router.replace('/signin');
      return;
    }

    if (isAuthenticated && routeType === 'auth') {
      // Allow verification page to complete its flow
      if (pathname === '/verify-email') {
        return;
      }
      hasRedirected.current = true;
      router.replace('/');
      return;
    }

  }, [isAuthenticated, isLoading, pathname, router]);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated && isProtectedRoute(pathname)) {
    return null;
  }

  return <>{children}</>;
}
/**
 * Route type definitions based on Next.js App Router folder structure
 */
export type RouteType = 'public' | 'private' | 'auth';

/**
 * Determines the route type based on pathname
 * Uses the existing folder structure patterns:
 * - (auth)/ routes: signin, signup, reset-password, verify-email
 * - (private)/ routes: dashboard, profile, add, products
 * - (public)/ routes: homepage, email-confirmation, and others
 */
export function getRouteType(pathname: string): RouteType {
  const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  
  // Auth routes (from (auth) folder group)
  const authRoutes = [
    '/signin',
    '/signup',
    '/reset-password'
  ];
  
  if (authRoutes.some(route => normalizedPath === route || normalizedPath.startsWith(route + '/'))) {
    return 'auth';
  }
  
  // Private routes (from (private) folder group)
  const privateRoutePatterns = [
    '/dashboard',
    '/profile',
    '/add',
    '/products'
  ];
  
  if (privateRoutePatterns.some(pattern => normalizedPath.startsWith(pattern))) {
    return 'private';
  }

  return 'public';
}

/**
 * Checks if a route requires authentication
 */
export function isProtectedRoute(pathname: string): boolean {
  return getRouteType(pathname) === 'private';
}

/**
 * Checks if a route is an authentication page
 */
export function isAuthRoute(pathname: string): boolean {
  return getRouteType(pathname) === 'auth';
}

/**
 * Checks if a route is publicly accessible
 */
export function isPublicRoute(pathname: string): boolean {
  return getRouteType(pathname) === 'public';
}
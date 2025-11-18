'use client';

import { useAuth } from '@/features/auth/hooks/useAuth';

export default function AuthStatus() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center space-x-4">
        <div className="text-sm">
          <span className="text-muted-foreground">Welcome, </span>
          <span className="font-medium text-foreground">{user.name}</span>
        </div>
        <button
          onClick={logout}
          className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 transition-colors"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="text-sm text-muted-foreground">
      Not authenticated
    </div>
  );
}
'use client';

import { useAuth } from '@/features/auth/hooks/useAuth';

export default function AuthStatus() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm text-gray-600">Loading...</span>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center space-x-4">
        <div className="text-sm">
          <span className="text-gray-600">Welcome, </span>
          <span className="font-medium text-gray-900">{user.name}</span>
        </div>
        <button
          onClick={logout}
          className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="text-sm text-gray-600">
      Not authenticated
    </div>
  );
}
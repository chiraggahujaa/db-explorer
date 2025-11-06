import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// Define the user interface
interface User {
  id: string;
  email: string;
  name: string | null;
  emailConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Define the store state interface
interface AppState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

// Define the store actions interface
interface AppActions {
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  logout: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearTokens: () => void;
}

// Combine state and actions
type AppStore = AppState & AppActions;

// Create the Zustand store
export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        user: null,
        isLoading: true, // Start with loading true to prevent premature redirects
        error: null,

        // Actions
        setUser: (user) => set({ user, error: null }, false, 'setUser'),

        setLoading: (isLoading) => set(
          { isLoading },
          false,
          'setLoading'
        ),

        setError: (error) => set(
          { error },
          false,
          'setError'
        ),

        clearError: () => set(
          { error: null },
          false,
          'clearError'
        ),

        logout: () => {
          // Clear tokens from storage
          if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            sessionStorage.removeItem('access_token');
            sessionStorage.removeItem('refresh_token');
          }

          set(
            { user: null, error: null },
            false,
            'logout'
          );
        },

        setTokens: (accessToken, refreshToken) => {
          if (typeof window !== 'undefined') {
            localStorage.setItem('access_token', accessToken);
            localStorage.setItem('refresh_token', refreshToken);
          }
        },

        clearTokens: () => {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            sessionStorage.removeItem('access_token');
            sessionStorage.removeItem('refresh_token');
          }
        },
      }),
      {
        name: 'app-store',
        partialize: (state) => ({
          user: state.user,
        }),
      }
    ),
    {
      name: 'app-store',
    }
  )
);
import axios from 'axios';

// Create axios instance with base configuration
const baseURL = (() => {
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (!env) return 'http://localhost:5000';
  // Ensure no trailing slash
  return env.replace(/\/$/, '');
})();

const api = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage or sessionStorage
    const token = typeof window !== 'undefined' 
      ? localStorage.getItem('access_token') || sessionStorage.getItem('access_token')
      : null;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 errors (unauthorized)
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      // Do not try to refresh for the refresh endpoint itself
      typeof originalRequest?.url === 'string' &&
      !originalRequest.url.includes('/api/auth/refresh')
    ) {
      originalRequest._retry = true;

      // Try to refresh token
      const refreshToken = typeof window !== 'undefined'
        ? localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token')
        : null;

      if (refreshToken) {
        try {
          const response = await api.post('/api/auth/refresh', {
            refreshToken,
          });

          if (response.data.success) {
            const { access_token, refresh_token } = response.data.data.session;
            
            // Store new tokens
            if (typeof window !== 'undefined') {
              localStorage.setItem('access_token', access_token);
              localStorage.setItem('refresh_token', refresh_token);
            }

            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
            return api(originalRequest);
          }
        } catch {
          // Refresh failed, clear tokens and redirect to login
          if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            sessionStorage.removeItem('access_token');
            sessionStorage.removeItem('refresh_token');
          }
          
          console.log('Token refresh failed, letting AuthGuard handle redirect');
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;

export const APP_CONFIG = {
  name: 'DB Explorer',
  description: 'A modern database exploration and management platform',
  version: '1.0.0',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
} as const;

export const AUTH_CONFIG = {
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  refreshTokenExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
} as const;
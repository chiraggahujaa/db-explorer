/**
 * Environment utilities for getting configuration values
 */

/**
 * Get the frontend URL from environment variables
 * @returns The frontend URL for the current environment
 */
export const getFrontendUrl = (): string => {
  return process.env.FRONTEND_URL || 'http://localhost:3000';
};
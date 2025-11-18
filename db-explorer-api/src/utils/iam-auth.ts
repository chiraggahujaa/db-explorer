/**
 * IAM Authentication Utilities for AWS RDS
 *
 * Generates temporary authentication tokens for connecting to RDS databases
 * using AWS IAM credentials instead of passwords.
 */

import { Signer } from '@aws-sdk/rds-signer';
import { fromIni } from '@aws-sdk/credential-providers';
import type { IAMAuthConfig } from '../types/connection';

export interface IAMTokenOptions {
  hostname: string;
  port: number;
  username: string;
  region: string;
  iamConfig: IAMAuthConfig;
}

/**
 * Generate an IAM authentication token for RDS database connection
 *
 * @param options - Configuration for token generation
 * @returns Promise resolving to the authentication token (valid for 15 minutes)
 */
export async function generateIAMAuthToken(options: IAMTokenOptions): Promise<string> {
  const { hostname, port, username, region, iamConfig } = options;

  let credentials;

  // Configure credentials based on the credential type
  switch (iamConfig.credential_type) {
    case 'accessKey':
      // Use provided access key and secret access key
      if (!iamConfig.access_key_id || !iamConfig.secret_access_key) {
        throw new Error('Access key ID and secret access key are required for accessKey credential type');
      }
      credentials = {
        accessKeyId: iamConfig.access_key_id,
        secretAccessKey: iamConfig.secret_access_key,
      };
      break;

    case 'credentialFile':
      // Use AWS credentials file with optional profile
      const profile = iamConfig.profile || 'default';
      const credentialFilePath = iamConfig.credential_file_path;

      credentials = fromIni({
        profile,
        ...(credentialFilePath && { filepath: credentialFilePath }),
      });
      break;

    case 'default':
      // Use AWS SDK default credential provider chain
      // This will check environment variables, instance metadata, etc.
      credentials = undefined; // SDK will use default provider chain
      break;

    default:
      throw new Error(`Unknown credential type: ${iamConfig.credential_type}`);
  }

  // Create the RDS signer
  const signer = new Signer({
    hostname,
    port,
    username,
    region,
    ...(credentials && { credentials }),
  });

  try {
    // Generate and return the authentication token
    const token = await signer.getAuthToken();
    return token;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to generate IAM authentication token: ${errorMessage}`);
  }
}

/**
 * Validate IAM authentication configuration
 *
 * @param iamConfig - IAM auth configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateIAMConfig(iamConfig: IAMAuthConfig): void {
  if (!iamConfig.region) {
    throw new Error('AWS region is required for IAM authentication');
  }

  if (iamConfig.credential_type === 'accessKey') {
    if (!iamConfig.access_key_id || !iamConfig.secret_access_key) {
      throw new Error('Access key ID and secret access key are required for accessKey credential type');
    }

    // Basic validation for access key format
    if (iamConfig.access_key_id.length < 16) {
      throw new Error('Access key ID must be at least 16 characters');
    }

    if (iamConfig.secret_access_key.length < 40) {
      throw new Error('Secret access key must be at least 40 characters');
    }
  }

  if (iamConfig.credential_type === 'credentialFile') {
    // Profile name validation if provided
    if (iamConfig.profile && iamConfig.profile.trim().length === 0) {
      throw new Error('Profile name cannot be empty');
    }
  }
}

/**
 * Check if a connection uses IAM authentication
 *
 * @param config - Connection configuration
 * @returns true if IAM authentication is enabled
 */
export function isIAMAuthEnabled(config: any): boolean {
  return config?.auth_type === 'iam' && !!config?.iam_auth;
}

/**
 * Token cache to avoid regenerating tokens too frequently
 * Tokens are valid for 15 minutes, we'll cache for 12 minutes to be safe
 */
interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, TokenCacheEntry>();
const TOKEN_CACHE_DURATION = 12 * 60 * 1000; // 12 minutes in milliseconds

/**
 * Get a cached token or generate a new one if needed
 *
 * @param options - Token generation options
 * @returns Promise resolving to the authentication token
 */
export async function getCachedIAMAuthToken(options: IAMTokenOptions): Promise<string> {
  const cacheKey = `${options.hostname}:${options.port}:${options.username}:${options.region}`;
  const now = Date.now();

  // Check if we have a valid cached token
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.token;
  }

  // Generate a new token
  const token = await generateIAMAuthToken(options);

  // Cache the token
  tokenCache.set(cacheKey, {
    token,
    expiresAt: now + TOKEN_CACHE_DURATION,
  });

  return token;
}

/**
 * Clear the token cache for a specific connection
 * Useful when connection parameters change or on error
 *
 * @param hostname - Database hostname
 * @param port - Database port
 * @param username - Database username
 * @param region - AWS region
 */
export function clearTokenCache(hostname: string, port: number, username: string, region: string): void {
  const cacheKey = `${hostname}:${port}:${username}:${region}`;
  tokenCache.delete(cacheKey);
}

/**
 * Clear all cached tokens
 */
export function clearAllTokenCache(): void {
  tokenCache.clear();
}

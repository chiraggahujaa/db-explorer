/**
 * Permission Management System
 * Handles permission requests for sensitive database operations
 */

import { logger } from './logger.js';

export type PermissionType = 
  | 'table_access'
  | 'data_modification' 
  | 'schema_change'
  | 'large_query'
  | 'sensitive_table';

export interface PermissionRequest {
  type: PermissionType;
  resource: string;
  action: string;
  message: string;
  details?: Record<string, any>;
}

export interface PermissionResponse {
  approved: boolean;
  alwaysAllow?: boolean;
}

// Sensitive table patterns (can be configured)
const SENSITIVE_TABLE_PATTERNS = [
  'users',
  'passwords',
  'auth',
  'credentials',
  'tokens',
  'sessions',
  'payments',
  'transactions',
];

// Permission cache (in-memory, per session)
// In a production environment, this would be stored in a database
const permissionCache = new Map<string, boolean>();

/**
 * Check if a table is considered sensitive
 */
export function isSensitiveTable(tableName: string): boolean {
  const lowerTableName = tableName.toLowerCase();
  return SENSITIVE_TABLE_PATTERNS.some(pattern => 
    lowerTableName.includes(pattern)
  );
}

/**
 * Check if permission is required for data modification
 */
export function requiresPermissionForModification(
  table: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
): PermissionRequest | null {
  const permLogger = logger.child('Permissions');
  
  // Check cache first
  const cacheKey = `${operation}:${table}`;
  if (permissionCache.has(cacheKey)) {
    permLogger.debug('Permission cached', { operation, table, approved: permissionCache.get(cacheKey) });
    return null; // Permission already granted
  }

  // Always require permission for DELETE operations
  if (operation === 'DELETE') {
    return {
      type: 'data_modification',
      resource: table,
      action: operation,
      message: `Do you want to allow DELETE operation on table '${table}'?`,
      details: { operation, table },
    };
  }

  // Require permission for sensitive tables
  if (isSensitiveTable(table)) {
    return {
      type: 'sensitive_table',
      resource: table,
      action: operation,
      message: `Do you want to allow ${operation} operation on sensitive table '${table}'?`,
      details: { operation, table, sensitive: true },
    };
  }

  // No permission required for INSERT/UPDATE on non-sensitive tables
  return null;
}

/**
 * Check if permission is required for table access
 */
export function requiresPermissionForAccess(
  table: string,
  operation: 'SELECT'
): PermissionRequest | null {
  const permLogger = logger.child('Permissions');
  
  // Check cache first
  const cacheKey = `${operation}:${table}`;
  if (permissionCache.has(cacheKey)) {
    permLogger.debug('Permission cached', { operation, table, approved: permissionCache.get(cacheKey) });
    return null; // Permission already granted
  }

  // Only require permission for sensitive tables
  if (isSensitiveTable(table)) {
    return {
      type: 'sensitive_table',
      resource: table,
      action: operation,
      message: `Do you want to allow access to sensitive table '${table}'?`,
      details: { operation, table, sensitive: true },
    };
  }

  return null;
}

/**
 * Check if permission is required for large queries
 */
export function requiresPermissionForLargeQuery(
  rowCount: number,
  threshold: number = 1000
): PermissionRequest | null {
  if (rowCount > threshold) {
    return {
      type: 'large_query',
      resource: 'database',
      action: 'SELECT',
      message: `This query will return ${rowCount} rows. Do you want to continue?`,
      details: { rowCount, threshold },
    };
  }
  return null;
}

/**
 * Grant permission (cache it)
 */
export function grantPermission(
  operation: string,
  resource: string,
  alwaysAllow: boolean = false
): void {
  const permLogger = logger.child('Permissions');
  const cacheKey = `${operation}:${resource}`;
  
  if (alwaysAllow) {
    permissionCache.set(cacheKey, true);
    permLogger.info('Permission granted (always allow)', { operation, resource });
  } else {
    permLogger.info('Permission granted (one-time)', { operation, resource });
  }
}

/**
 * Revoke permission (remove from cache)
 */
export function revokePermission(operation: string, resource: string): void {
  const permLogger = logger.child('Permissions');
  const cacheKey = `${operation}:${resource}`;
  permissionCache.delete(cacheKey);
  permLogger.info('Permission revoked', { operation, resource });
}

/**
 * Clear all permissions from cache
 */
export function clearAllPermissions(): void {
  const permLogger = logger.child('Permissions');
  permissionCache.clear();
  permLogger.info('All permissions cleared');
}

/**
 * Create a permission request response
 */
export function createPermissionRequest(request: PermissionRequest): {
  content: Array<{ type: 'text'; text: string }>;
  isError: boolean;
  code: string;
  permission: PermissionRequest;
} {
  return {
    content: [{
      type: 'text' as const,
      text: request.message,
    }],
    isError: true,
    code: 'PERMISSION_REQUIRED',
    permission: request,
  };
}





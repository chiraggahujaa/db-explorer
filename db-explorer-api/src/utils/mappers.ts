/**
 * Centralized data transformation utilities for converting between snake_case and camelCase
 * Based on best practices from Supabase community and performance optimizations
 */

export interface MapperConfig {
  transformKeys: 'camelCase' | 'snake_case';
  transformDates: boolean;
  transformNumbers: boolean;
  excludeFields?: string[];
  includeNested: boolean;
}

const DEFAULT_CONFIG: MapperConfig = {
  transformKeys: 'camelCase',
  transformDates: true,
  transformNumbers: true,
  excludeFields: [],
  includeNested: true,
};

/**
 * Convert snake_case string to camelCase
 * Optimized for performance using string iteration instead of regex
 */
function toCamelCaseString(str: string): string {
  if (!str || typeof str !== 'string') return str;
  
  let result = '';
  let shouldCapitalize = false;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char && char === '_') {
      shouldCapitalize = true;
    } else if (char) {
      result += shouldCapitalize ? char.toUpperCase() : char;
      shouldCapitalize = false;
    }
  }
  
  return result;
}

/**
 * Convert camelCase string to snake_case
 * Optimized for performance using string iteration
 */
function toSnakeCaseString(str: string): string {
  if (!str || typeof str !== 'string') return str;
  
  let result = '';
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char && char >= 'A' && char <= 'Z') {
      if (i > 0) result += '_';
      result += char.toLowerCase();
    } else if (char) {
      result += char;
    }
  }
  
  return result;
}

/**
 * Check if a value is a plain object (not Date, Array, null, etc.)
 */
function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  return obj !== null && 
         typeof obj === 'object' && 
         Object.prototype.toString.call(obj) === '[object Object]';
}

/**
 * Transform object keys based on configuration
 */
function transformKeys(
  obj: Record<string, unknown>, 
  config: MapperConfig
): Record<string, unknown> {
  const transformed: Record<string, unknown> = {};
  const { excludeFields = [] } = config;
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip excluded fields
    if (excludeFields.includes(key)) {
      transformed[key] = value;
      continue;
    }
    
    // Transform the key
    const newKey = config.transformKeys === 'camelCase' 
      ? toCamelCaseString(key)
      : toSnakeCaseString(key);
    
    // Transform nested objects and arrays if enabled
    if (config.includeNested) {
      if (isPlainObject(value)) {
        transformed[newKey] = transformKeys(value, config);
      } else if (Array.isArray(value)) {
        transformed[newKey] = value.map(item => 
          isPlainObject(item) ? transformKeys(item, config) : item
        );
      } else {
        transformed[newKey] = value;
      }
    } else {
      transformed[newKey] = value;
    }
  }
  
  return transformed;
}

/**
 * Main DataMapper class with static methods for data transformation
 */
export class DataMapper {
  /**
   * Transform data to camelCase format
   */
  static toCamelCase<T>(data: T, config?: Partial<MapperConfig>): T {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    
    if (data === null || data === undefined) {
      return data;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => 
        isPlainObject(item) 
          ? transformKeys(item, finalConfig) 
          : item
      ) as T;
    }
    
    if (isPlainObject(data)) {
      return transformKeys(data, finalConfig) as T;
    }
    
    return data;
  }
  
  /**
   * Transform data to snake_case format
   */
  static toSnakeCase<T>(data: T, config?: Partial<MapperConfig>): T {
    const finalConfig = { 
      ...DEFAULT_CONFIG, 
      ...config, 
      transformKeys: 'snake_case' as const 
    };
    
    if (data === null || data === undefined) {
      return data;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => 
        isPlainObject(item) 
          ? transformKeys(item, finalConfig) 
          : item
      ) as T;
    }
    
    if (isPlainObject(data)) {
      return transformKeys(data, finalConfig) as T;
    }
    
    return data;
  }
  
  /**
   * Transform array of objects
   */
  static mapArray<T>(data: T[], config?: Partial<MapperConfig>): T[] {
    if (!Array.isArray(data)) return data;
    
    return data.map(item => DataMapper.toCamelCase(item, config));
  }
  
  /**
   * Transform nested objects with custom handling for relations
   */
  static mapWithRelations<T>(
    data: T, 
    relationMappings?: Record<string, (item: unknown) => unknown>,
    config?: Partial<MapperConfig>
  ): T {
    const transformed = DataMapper.toCamelCase(data, config);
    
    if (!relationMappings || !isPlainObject(transformed)) {
      return transformed;
    }
    
    const result = { ...transformed } as Record<string, unknown>;
    
    // Apply custom relation mappings
    for (const [relationKey, mapper] of Object.entries(relationMappings)) {
      if (relationKey in result) {
        const relationData = result[relationKey];
        if (Array.isArray(relationData)) {
          result[relationKey] = relationData.map(mapper);
        } else if (relationData !== null && relationData !== undefined) {
          result[relationKey] = mapper(relationData);
        }
      }
    }
    
    return result as T;
  }
}

/**
 * Specialized mappers for common API patterns
 */
export class ApiMappers {
  /**
   * Transform Supabase query result with metadata
   */
  static transformSupabaseResult<T>(result: {
    data: T[] | T | null;
    error?: any;
    count?: number | null;
  }): {
    data: T[] | T | null;
    error?: any;
    count?: number | null;
  } {
    return {
      ...result,
      data: result.data ? DataMapper.toCamelCase(result.data) : result.data,
    };
  }
  
  /**
   * Transform paginated response
   */
  static transformPaginatedResponse<T>(response: {
    data: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }): {
    data: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  } {
    return {
      data: DataMapper.mapArray(response.data),
      pagination: response.pagination, // Pagination metadata is already camelCase
    };
  }
}

/**
 * Utility functions for specific transformations
 */
export const MapperUtils = {
  /**
   * Convert snake_case string to camelCase
   */
  toCamelCase: toCamelCaseString,
  
  /**
   * Convert camelCase string to snake_case
   */
  toSnakeCase: toSnakeCaseString,
  
  /**
   * Check if object is a plain object
   */
  isPlainObject,
};

/**
 * Sanitize connection config by removing sensitive fields (passwords, keys, tokens)
 * This prevents sensitive credentials from being exposed in API responses
 */
export function sanitizeConnectionConfig(config: any): any {
  if (!config || typeof config !== 'object') {
    return config;
  }

  const sanitized = { ...config };

  // Remove password fields (various naming conventions)
  const sensitiveFields = [
    'password',
    'passwd',
    'pwd',
    'service_role_key',
    'serviceRoleKey',
    'anon_key',
    'anonKey',
    'api_key',
    'apiKey',
    'access_token',
    'accessToken',
    'secret',
    'secret_key',
    'secretKey',
    'token',
    'auth_token',
    'authToken',
  ];

  sensitiveFields.forEach((field) => {
    if (field in sanitized) {
      delete sanitized[field];
    }
  });

  return sanitized;
}
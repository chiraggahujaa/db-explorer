// Base service class with common database operations

import { supabaseAdmin } from '../utils/database.js';
import { ApiResponse, PaginatedResponse } from '../types/common.js';
import { DataMapper } from '../utils/mappers.js';

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface QueryOptions extends PaginationOptions {
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export class BaseService {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Get all records with pagination and filtering
   */
  async findAll(options: QueryOptions = { page: 1, limit: 20 }): Promise<PaginatedResponse<any>> {
    try {
      const { page, limit, orderBy = 'created_at', orderDirection = 'desc', filters = {} } = options;
      const offset = (page - 1) * limit;

      let query = supabaseAdmin.from(this.tableName).select('*', { count: 'exact' });

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            query = query.in(key, value);
          } else if (typeof value === 'string' && value.includes('%')) {
            query = query.ilike(key, value);
          } else {
            query = query.eq(key, value);
          }
        }
      });

      // Apply ordering and pagination
      query = query.order(orderBy, { ascending: orderDirection === 'asc' });
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const totalPages = Math.ceil((count || 0) / limit);

      return {
        success: true,
        data: DataMapper.toCamelCase(data || []),
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error(`Error in ${this.tableName} findAll:`, error);
      throw error;
    }
  }

  /**
   * Find a single record by ID
   */
  async findById(id: string, select: string = '*'): Promise<ApiResponse<any>> {
    try {
      const { data, error } = await supabaseAdmin
        .from(this.tableName)
        .select(select)
        .eq(this.getIdColumn(), id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: 'Record not found',
          };
        }
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        data: DataMapper.toCamelCase(data),
      };
    } catch (error) {
      console.error(`Error in ${this.tableName} findById:`, error);
      throw error;
    }
  }

  /**
   * Create a new record
   */
  async create(data: Record<string, any>): Promise<ApiResponse<any>> {
    try {
      const snakeCaseData = DataMapper.toSnakeCase(data);
      
      const { data: result, error } = await supabaseAdmin
        .from(this.tableName)
        .insert(snakeCaseData)
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        data: DataMapper.toCamelCase(result),
        message: 'Record created successfully',
      };
    } catch (error) {
      console.error(`Error in ${this.tableName} create:`, error);
      throw error;
    }
  }

  /**
   * Update a record by ID
   */
  async update(id: string, data: Record<string, any>): Promise<ApiResponse<any>> {
    try {
      const snakeCaseData = DataMapper.toSnakeCase(data);
      
      const { data: result, error } = await supabaseAdmin
        .from(this.tableName)
        .update(snakeCaseData)
        .eq(this.getIdColumn(), id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: 'Record not found',
          };
        }
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        data: DataMapper.toCamelCase(result),
        message: 'Record updated successfully',
      };
    } catch (error) {
      console.error(`Error in ${this.tableName} update:`, error);
      throw error;
    }
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string): Promise<ApiResponse<any>> {
    try {
      const { error } = await supabaseAdmin
        .from(this.tableName)
        .delete()
        .eq(this.getIdColumn(), id);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        message: 'Record deleted successfully',
      };
    } catch (error) {
      console.error(`Error in ${this.tableName} delete:`, error);
      throw error;
    }
  }

  /**
   * Bulk delete records by IDs
   */
  async bulkDelete(ids: string[]): Promise<ApiResponse<any>> {
    try {
      const { error } = await supabaseAdmin
        .from(this.tableName)
        .delete()
        .in(this.getIdColumn(), ids);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        message: `${ids.length} records deleted successfully`,
      };
    } catch (error) {
      console.error(`Error in ${this.tableName} bulkDelete:`, error);
      throw error;
    }
  }

  /**
   * Count records with optional filters
   */
  async count(filters: Record<string, any> = {}): Promise<number> {
    try {
      let query = supabaseAdmin.from(this.tableName).select('*', { count: 'exact', head: true });

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            query = query.in(key, value);
          } else {
            query = query.eq(key, value);
          }
        }
      });

      const { count, error } = await query;

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return count || 0;
    } catch (error) {
      console.error(`Error in ${this.tableName} count:`, error);
      throw error;
    }
  }

  /**
   * Check if a record exists
   */
  async exists(id: string): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .from(this.tableName)
        .select(this.getIdColumn())
        .eq(this.getIdColumn(), id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Database error: ${error.message}`);
      }

      return !!data;
    } catch (error) {
      console.error(`Error in ${this.tableName} exists:`, error);
      return false;
    }
  }

  /**
   * Find records with complex filtering
   */
  async findWhere(
    conditions: Record<string, any>,
    options: Partial<QueryOptions> = {}
  ): Promise<PaginatedResponse<any>> {
    return this.findAll({ ...options, filters: conditions } as QueryOptions);
  }

  /**
   * Execute a custom query
   */
  async executeQuery(query: any): Promise<any> {
    try {
      const { data, error } = await query;

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error(`Error in ${this.tableName} executeQuery:`, error);
      throw error;
    }
  }

  /**
   * Get the primary key column name for the table
   */
  protected getIdColumn(): string {
    return 'id';
  }

  /**
   * Batch operations
   */
  async batchInsert(records: Record<string, any>[]): Promise<ApiResponse<any[]>> {
    try {
      const { data, error } = await supabaseAdmin
        .from(this.tableName)
        .insert(records)
        .select();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        data: DataMapper.toCamelCase(data || []),
        message: `${records.length} records created successfully`,
      };
    } catch (error) {
      console.error(`Error in ${this.tableName} batchInsert:`, error);
      throw error;
    }
  }

  /**
   * Upsert operation (insert or update)
   */
  async upsert(data: Record<string, any>): Promise<ApiResponse<any>> {
    try {
      const { data: result, error } = await supabaseAdmin
        .from(this.tableName)
        .upsert(data)
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        data: DataMapper.toCamelCase(result),
        message: 'Record upserted successfully',
      };
    } catch (error) {
      console.error(`Error in ${this.tableName} upsert:`, error);
      throw error;
    }
  }
}
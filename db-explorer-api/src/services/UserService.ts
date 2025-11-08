// User service for database operations
// Clean auth-focused implementation

import { BaseService } from './BaseService.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { CreateUserDto, UpdateUserDto, User } from '../types/user.js';
import { ApiResponse } from '../types/common.js';
import { DataMapper } from '../utils/mappers.js';

export class UserService extends BaseService {
  constructor() {
    super('users');
  }

  // Helper methods
  protected successResponse<T>(data: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      ...(message && { message }),
    };
  }

  protected errorResponse(error: string): ApiResponse<any> {
    return {
      success: false,
      error,
    };
  }

  /**
   * Create a new user
   */
  async createUser(userData: CreateUserDto): Promise<ApiResponse<User>> {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .insert([userData])
        .select()
        .single();

      if (error) {
        console.error('Create user error:', error);
        return this.errorResponse('Failed to create user');
      }

      return this.successResponse(data, 'User created successfully');
    } catch (error) {
      console.error('Create user error:', error);
      return this.errorResponse('Failed to create user');
    }
  }

  /**
   * Transform database user data to API format
   * Maps snake_case to camelCase and handles special field mappings
   */
  private transformUserData(data: any): User {
    const transformed = DataMapper.toCamelCase(data);
    // Map dateOfBirth to dob for API consistency
    if (transformed.dateOfBirth !== undefined) {
      transformed.dob = transformed.dateOfBirth;
      delete transformed.dateOfBirth;
    }
    return transformed as User;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<ApiResponse<User>> {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return this.errorResponse('User not found');
      }

      return this.successResponse(this.transformUserData(data));
    } catch (error) {
      console.error('Get user error:', error);
      return this.errorResponse('Failed to get user');
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<ApiResponse<User>> {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !data) {
        return this.errorResponse('User not found');
      }

      return this.successResponse(this.transformUserData(data));
    } catch (error) {
      console.error('Get user by email error:', error);
      return this.errorResponse('Failed to get user');
    }
  }

  /**
   * Update user profile
   */
  async updateUser(userId: string, userData: UpdateUserDto): Promise<ApiResponse<User>> {
    try {
      // Map camelCase fields to snake_case for database
      const dbData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (userData.fullName !== undefined) {
        dbData.full_name = userData.fullName;
      }
      if (userData.phoneNumber !== undefined) {
        dbData.phone = userData.phoneNumber;
      }
      if (userData.gender !== undefined) {
        dbData.gender = userData.gender;
      }
      if (userData.dob !== undefined) {
        dbData.date_of_birth = userData.dob;
      }
      if (userData.bio !== undefined) {
        dbData.bio = userData.bio;
      }
      if (userData.avatarUrl !== undefined) {
        dbData.avatar_url = userData.avatarUrl;
      }

      const { data, error } = await supabaseAdmin
        .from('users')
        .update(dbData)
        .eq('id', userId)
        .select()
        .single();

      if (error || !data) {
        console.error('Update user error:', error);
        return this.errorResponse('Failed to update user');
      }

      return this.successResponse(this.transformUserData(data), 'User updated successfully');
    } catch (error) {
      console.error('Update user error:', error);
      return this.errorResponse('Failed to update user');
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: string): Promise<ApiResponse<User>> {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();

      if (error || !data) {
        console.error('Deactivate user error:', error);
        return this.errorResponse('Failed to deactivate user');
      }

      return this.successResponse(data, 'User deactivated successfully');
    } catch (error) {
      console.error('Deactivate user error:', error);
      return this.errorResponse('Failed to deactivate user');
    }
  }
}

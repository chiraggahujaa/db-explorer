import { BaseEntity, UserGender } from './common.js';

export interface User extends BaseEntity {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  gender?: UserGender;
  dob?: string;
  trustScore: number;
  isVerified: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  avatarUrl?: string;
  bio?: string;
  isActive: boolean;
}

// User Favorite interface
export interface UserFavorite {
  id: string;
  userId: string;
  itemId: string;
  createdAt: string;
  
  // Relations
  user?: User;
}

// Create/Update DTOs (Data Transfer Objects)
export interface CreateUserDto {
  fullName: string;
  email: string;
  phoneNumber?: string;
  gender?: UserGender;
  dob?: string;
  bio?: string;
}

export interface UpdateUserDto {
  fullName?: string;
  phoneNumber?: string;
  gender?: UserGender;
  dob?: string;
  bio?: string;
  avatarUrl?: string;
}
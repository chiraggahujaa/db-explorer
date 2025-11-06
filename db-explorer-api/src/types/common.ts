export type UserGender = 'male' | 'female' | 'other' | 'preferNotToSay';
export type UserDobVisibility = 'public' | 'friends' | 'private';
export type FileType = 'image' | 'document' | 'video' | 'other';
export type DeviceType = 'web' | 'mobileIos' | 'mobileAndroid' | 'desktop';
export type ItemCondition = 'new' | 'likeNew' | 'good' | 'fair' | 'poor';
export type ItemStatus = 'available' | 'booked' | 'inTransit' | 'delivered' | 'returned' | 'maintenance' | 'inactive';
export type BookingStatus = 'pending' | 'confirmed' | 'inProgress' | 'completed' | 'cancelled' | 'disputed';
export type DeliveryMode = 'none' | 'pickup' | 'delivery' | 'both';
export type PaymentMethod = 'card' | 'upi' | 'wallet' | 'bankTransfer' | 'cash';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partiallyRefunded';
export type SupportStatus = 'open' | 'inProgress' | 'resolved' | 'closed';
export type IssueType = 'booking' | 'payment' | 'itemQuality' | 'delivery' | 'userBehavior' | 'technical' | 'other';

export interface BaseEntity {
  createdAt: string;
  updatedAt: string;
}

export interface Location extends BaseEntity {
  id: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface File {
  id: string;
  userId: string;
  name: string;
  url: string;
  uploadedOn: string;
  fileType: FileType;
  fileSize?: number;
  mimeType?: string;
  altText?: string;
  isPublic: boolean;
}

export interface Device {
  id: string;
  userId: string;
  deviceType: DeviceType;
  osVersion?: string;
  appVersion?: string;
  deviceToken?: string;
  lastLoginAt: string;
  isActive: boolean;
  createdAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: any;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
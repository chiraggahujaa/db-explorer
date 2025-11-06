import { z } from 'zod';

// Common validation patterns
export const uuidSchema = z.string().uuid('Invalid UUID format');
export const emailSchema = z.string().email('Invalid email format');
export const phoneSchema = z.string().regex(/^[+]?[\d\s\-\(\)]{10,15}$/, 'Invalid phone number format').optional();
export const urlSchema = z.string().url('Invalid URL format').optional();
export const positiveNumberSchema = z.number().positive('Must be a positive number');
export const dateSchema = z.string().datetime('Invalid date format').optional();

// Strict password validation for business use
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character')
  .refine((password) => {
    // Check against common passwords
    const commonPasswords = [
      'password', 'password123', '123456', '123456789', 'qwerty',
      'abc123', 'password1', 'admin', 'letmein', 'welcome',
      '12345678', 'iloveyou', 'princess', 'dragon', 'monkey'
    ];
    return !commonPasswords.includes(password.toLowerCase());
  }, {
    message: 'Password is too common. Please choose a more secure password.'
  });

// Enum validations
export const userGenderSchema = z.enum(['male', 'female', 'other', 'preferNotToSay'] as const);
export const userDobVisibilitySchema = z.enum(['public', 'friends', 'private'] as const);
export const fileTypeSchema = z.enum(['image', 'document', 'video', 'other'] as const);
export const deviceTypeSchema = z.enum(['web', 'mobileIos', 'mobileAndroid', 'desktop'] as const);
export const itemConditionSchema = z.enum(['new', 'likeNew', 'good', 'fair', 'poor'] as const);
export const itemStatusSchema = z.enum(['available', 'booked', 'inTransit', 'delivered', 'returned', 'maintenance', 'inactive'] as const);
export const bookingStatusSchema = z.enum(['pending', 'confirmed', 'inProgress', 'completed', 'cancelled', 'disputed'] as const);
export const deliveryModeSchema = z.enum(['pickup', 'delivery', 'both', 'none'] as const);
export const paymentMethodSchema = z.enum(['card', 'upi', 'wallet', 'bankTransfer', 'cash'] as const);
export const paymentStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed', 'refunded', 'partiallyRefunded'] as const);
export const supportStatusSchema = z.enum(['open', 'inProgress', 'resolved', 'closed'] as const);
export const issueTypeSchema = z.enum(['booking', 'payment', 'itemQuality', 'delivery', 'userBehavior', 'technical', 'other'] as const);

// Location validation schemas
export const createLocationSchema = z.object({
  addressLine: z.string().min(5, 'Address line must be at least 5 characters').max(255, 'Address line too long'),
  city: z.string().min(2, 'City name must be at least 2 characters').max(100, 'City name too long'),
  state: z.string().min(2, 'State name must be at least 2 characters').max(100, 'State name too long'),
  pincode: z.string().regex(/^[0-9]{6}$/, 'Invalid pincode format (6 digits required)'),
  country: z.string().max(100, 'Country name too long').default('India'),
  latitude: z.number().min(-90).max(90, 'Invalid latitude').optional(),
  longitude: z.number().min(-180).max(180, 'Invalid longitude').optional(),
});

export const updateLocationSchema = createLocationSchema.partial();

// Pagination schema
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// ID parameter validation
export const idParamSchema = z.object({
  id: uuidSchema,
});

// Multiple IDs validation
export const idsSchema = z.object({
  ids: z.array(uuidSchema).min(1, 'At least one ID is required').max(50, 'Maximum 50 IDs allowed'),
});

// File upload validation
export const fileUploadSchema = z.object({
  fieldname: z.string(),
  originalname: z.string(),
  encoding: z.string(),
  mimetype: z.string().regex(/^(image|video|application|text)\//, 'Invalid file type'),
  size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'), // 10MB limit
});

// Export validation functions for common use cases
export const validatePagination = (query: any) => {
  return paginationSchema.parse({
    page: query.page ? parseInt(query.page) : 1,
    limit: query.limit ? parseInt(query.limit) : 20,
  });
};

export const validateId = (params: any) => {
  return idParamSchema.parse(params);
};
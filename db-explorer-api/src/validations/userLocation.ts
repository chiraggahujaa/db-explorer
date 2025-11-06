import { z } from 'zod';
import { uuidSchema } from './common.js';

// Validation schema for creating a user location (adding existing location to address book)
export const createUserLocationSchema = z.object({
  locationId: uuidSchema,
  isDefault: z.boolean().optional().default(false),
  label: z.string()
    .min(1, 'Label is required')
    .max(50, 'Label must be less than 50 characters')
    .optional()
    .default('Location'),
});

// Validation schema for updating a user location
export const updateUserLocationSchema = z.object({
  location: z.object({
    addressLine: z.string()
      .min(1, 'Address line is required')
      .max(255, 'Address line must be less than 255 characters')
      .optional(),
    city: z.string()
      .min(1, 'City is required')
      .max(100, 'City must be less than 100 characters')
      .optional(),
    state: z.string()
      .min(1, 'State is required')
      .max(100, 'State must be less than 100 characters')
      .optional(),
    pincode: z.string()
      .regex(/^\d{6}$/, 'Pincode must be exactly 6 digits')
      .optional(),
    country: z.string()
      .max(100, 'Country must be less than 100 characters')
      .optional(),
    latitude: z.number()
      .min(-90, 'Latitude must be between -90 and 90')
      .max(90, 'Latitude must be between -90 and 90')
      .optional(),
    longitude: z.number()
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180, 'Longitude must be between -180 and 180')
      .optional(),
  }).optional(),
  isDefault: z.boolean().optional(),
  label: z.string()
    .min(1, 'Label cannot be empty')
    .max(50, 'Label must be less than 50 characters')
    .optional(),
}).refine(
  (data) => data.isDefault !== undefined || data.label !== undefined || data.location !== undefined,
  {
    message: 'At least one field (isDefault, label, or location) must be provided',
  }
);

// Validation schema for creating location and adding to address book
export const createAndAddLocationSchema = z.object({
  location: z.object({
    addressLine: z.string()
      .min(5, 'Address line must be at least 5 characters')
      .max(255, 'Address line must be less than 255 characters'),
    city: z.string()
      .min(2, 'City must be at least 2 characters')
      .max(100, 'City must be less than 100 characters'),
    state: z.string()
      .min(2, 'State must be at least 2 characters')
      .max(100, 'State must be less than 100 characters'),
    pincode: z.string()
      .regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
    country: z.string()
      .max(100, 'Country must be less than 100 characters')
      .optional()
      .default('India'),
    latitude: z.number()
      .min(-90, 'Latitude must be between -90 and 90')
      .max(90, 'Latitude must be between -90 and 90')
      .optional(),
    longitude: z.number()
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180, 'Longitude must be between -180 and 180')
      .optional(),
  }),
  label: z.string()
    .min(1, 'Label is required')
    .max(50, 'Label must be less than 50 characters')
    .optional()
    .default('Location'),
  isDefault: z.boolean().optional().default(false),
});

// Export types for TypeScript
export type CreateUserLocationDto = z.infer<typeof createUserLocationSchema>;
export type UpdateUserLocationDto = z.infer<typeof updateUserLocationSchema>;
export type CreateAndAddLocationDto = z.infer<typeof createAndAddLocationSchema>;
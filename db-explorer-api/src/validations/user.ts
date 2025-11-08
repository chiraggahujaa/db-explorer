import { z } from 'zod';
import { emailSchema, phoneSchema, urlSchema, userGenderSchema, createLocationSchema } from './common.js';

// User creation validation
export const createUserSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(255, 'Full name too long'),
  email: emailSchema,
  phoneNumber: phoneSchema,
  gender: userGenderSchema.optional(),
  dob: z.string().date('Invalid date format (YYYY-MM-DD)').optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  location: createLocationSchema.optional(),
}).refine(data => {
  if (data.dob) {
    const dobDate = new Date(data.dob);
    const today = new Date();
    const age = today.getFullYear() - dobDate.getFullYear();
    return age >= 18 && age <= 100;
  }
  return true;
}, {
  message: 'User must be between 18 and 100 years old',
  path: ['dob'],
});

// User update validation
export const updateUserSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(255, 'Full name too long').optional(),
  phoneNumber: phoneSchema,
  gender: userGenderSchema.optional(),
  dob: z.string().date('Invalid date format (YYYY-MM-DD)').optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  avatarUrl: urlSchema.optional(),
}).refine(data => {
  if (data.dob) {
    const dobDate = new Date(data.dob);
    const today = new Date();
    const age = today.getFullYear() - dobDate.getFullYear();
    return age >= 18 && age <= 100;
  }
  return true;
}, {
  message: 'User must be between 18 and 100 years old',
  path: ['dob'],
});

// User search validation
export const userSearchSchema = z.object({
  search: z.string().min(1, 'Search term is required').max(255, 'Search term too long'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});
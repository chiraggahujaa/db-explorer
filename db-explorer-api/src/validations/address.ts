import { z } from 'zod';

export const addressSearchSchema = z.object({
  query: z.string()
    .min(2, 'Search query must be at least 2 characters')
    .max(200, 'Search query too long')
    .trim(),
  limit: z.number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(50, 'Limit cannot exceed 50')
    .default(10),
  countryCode: z.string()
    .length(2, 'Country code must be 2 characters')
    .toUpperCase()
    .default('IN')
    .optional(),
  acceptLanguage: z.string()
    .max(50, 'Accept-Language header too long')
    .default('en')
    .optional(),
});

export type AddressSearchRequest = z.infer<typeof addressSearchSchema>;
// Validation schemas for database connections

import { z } from 'zod';

// Database type enum
export const databaseTypeSchema = z.enum(['mysql', 'postgresql', 'sqlite', 'supabase']);

// Connection role enum
export const connectionRoleSchema = z.enum(['owner', 'admin', 'developer', 'tester', 'viewer']);

// MySQL/PostgreSQL config schema
const sqlConnectionConfigSchema = z.object({
  type: z.enum(['mysql', 'postgresql']),
  host: z.string().min(1, 'Host is required'),
  port: z.number().int().min(1).max(65535, 'Port must be between 1 and 65535'),
  database: z.string().min(1, 'Database name is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  ssl: z.boolean().optional(),
});

// SQLite config schema
const sqliteConnectionConfigSchema = z.object({
  type: z.literal('sqlite'),
  file_path: z.string().min(1, 'File path is required'),
});

// Supabase config schema
const supabaseConnectionConfigSchema = z.object({
  type: z.literal('supabase'),
  url: z.string().url('Invalid Supabase URL'),
  anon_key: z.string().min(1, 'Anon key is required'),
  service_role_key: z.string().min(1, 'Service role key is required'),
  db_password: z.string().optional(),
});

// Union schema for all connection configs
export const connectionConfigSchema = z.discriminatedUnion('type', [
  sqlConnectionConfigSchema,
  sqliteConnectionConfigSchema,
  supabaseConnectionConfigSchema,
]);

// Create connection request schema
export const createConnectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  description: z.string().max(1000, 'Description is too long').optional(),
  db_type: databaseTypeSchema,
  config: connectionConfigSchema,
});

// Update connection request schema
export const updateConnectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long').optional(),
  description: z.string().max(1000, 'Description is too long').optional(),
  config: connectionConfigSchema.optional(),
  is_active: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

// Invite member request schema
export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: connectionRoleSchema.refine(
    (role) => role !== 'owner',
    { message: 'Cannot invite users as owners. Ownership can only be transferred.' }
  ),
});

// Update member role request schema
export const updateMemberRoleSchema = z.object({
  role: connectionRoleSchema,
});

// UUID validation schema
export const uuidSchema = z.string().uuid('Invalid ID format');

// Accept/Decline invitation schema
export const invitationActionSchema = z.object({
  invitation_id: uuidSchema,
});

// Query params for listing connections
export const listConnectionsQuerySchema = z.object({
  include_shared: z.enum(['true', 'false']).optional(),
  db_type: databaseTypeSchema.optional(),
  is_active: z.enum(['true', 'false']).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).optional(),
});

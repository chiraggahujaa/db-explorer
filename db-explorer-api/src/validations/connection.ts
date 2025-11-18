// Validation schemas for database connections

import { z } from 'zod';

// Database type enum
export const databaseTypeSchema = z.enum(['mysql', 'postgresql', 'sqlite', 'supabase']);

// Connection role enum
export const connectionRoleSchema = z.enum(['owner', 'admin', 'developer', 'tester', 'viewer']);

// Auth type enums
export const sqlAuthTypeSchema = z.enum(['password', 'iam']);
export const iamCredentialTypeSchema = z.enum(['accessKey', 'credentialFile', 'default']);

// AWS region validation (common regions)
const awsRegionSchema = z.string().regex(
  /^(us|eu|ap|sa|ca|me|af|cn|us-gov)-(east|west|south|north|central|northeast|southeast|northwest|southwest)-[1-3]$/,
  'Invalid AWS region format'
);

// IAM authentication config schema
const iamAuthConfigSchema = z.object({
  credential_type: iamCredentialTypeSchema,
  region: awsRegionSchema,
  access_key_id: z.string().min(16, 'Access key ID must be at least 16 characters').optional(),
  secret_access_key: z.string().min(40, 'Secret access key must be at least 40 characters').optional(),
  profile: z.string().min(1, 'Profile name is required').optional(),
  credential_file_path: z.string().min(1, 'Credential file path is required').optional(),
}).refine(
  (data) => {
    // For 'accessKey' type, both access_key_id and secret_access_key are required
    if (data.credential_type === 'accessKey') {
      return data.access_key_id && data.secret_access_key;
    }
    return true;
  },
  {
    message: 'Access key ID and secret access key are required for accessKey credential type',
    path: ['access_key_id'],
  }
);

// MySQL/PostgreSQL config schema with IAM support
const sqlConnectionConfigSchema = z.object({
  type: z.enum(['mysql', 'postgresql']),
  host: z.string().min(1, 'Host is required'),
  port: z.number().int().min(1).max(65535, 'Port must be between 1 and 65535'),
  database: z.string().min(1, 'Database name is required'),
  username: z.string().min(1, 'Username is required'),
  auth_type: sqlAuthTypeSchema.optional(),
  password: z.string().min(1, 'Password is required').optional(),
  ssl: z.boolean().optional(),
  iam_auth: iamAuthConfigSchema.optional(),
}).refine(
  (data) => {
    const authType = data.auth_type || 'password';
    // For password auth, password is required
    if (authType === 'password') {
      return !!data.password;
    }
    // For IAM auth, iam_auth is required and SSL must be enabled
    if (authType === 'iam') {
      return !!data.iam_auth && data.ssl !== false;
    }
    return true;
  },
  {
    message: 'Password is required for password authentication, or IAM auth config is required for IAM authentication (SSL must be enabled for IAM)',
    path: ['password'],
  }
);

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

// Invite member request schema (supports single email or multiple emails with same role)
export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  emails: z.array(z.string().email('Invalid email address')).min(1, 'At least one email is required').max(50, 'Cannot invite more than 50 users at once').optional(),
  role: connectionRoleSchema.refine(
    (role) => role !== 'owner',
    { message: 'Cannot invite users as owners. Ownership can only be transferred.' }
  ),
}).refine(
  (data) => data.email || (data.emails && data.emails.length > 0),
  { message: 'Either email or emails array must be provided' }
);

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

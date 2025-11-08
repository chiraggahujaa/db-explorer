// Types for database connections system

export type DatabaseType = 'mysql' | 'postgresql' | 'sqlite' | 'supabase';

export type ConnectionRole = 'owner' | 'admin' | 'developer' | 'tester' | 'viewer';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

// Base configuration interface
export interface BaseConnectionConfig {
  type: DatabaseType;
}

// MySQL/PostgreSQL configuration
export interface SQLConnectionConfig extends BaseConnectionConfig {
  type: 'mysql' | 'postgresql';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

// SQLite configuration
export interface SQLiteConnectionConfig extends BaseConnectionConfig {
  type: 'sqlite';
  file_path: string;
}

// Supabase configuration
export interface SupabaseConnectionConfig extends BaseConnectionConfig {
  type: 'supabase';
  url: string;
  anon_key: string;
  service_role_key: string;
  db_password?: string;
}

// Union type for all connection configs
export type ConnectionConfig =
  | SQLConnectionConfig
  | SQLiteConnectionConfig
  | SupabaseConnectionConfig;

// Database connection entity
export interface DatabaseConnection {
  id: string;
  name: string;
  description?: string;
  db_type: DatabaseType;
  config: ConnectionConfig;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Connection member entity
export interface ConnectionMember {
  id: string;
  connection_id: string;
  user_id: string;
  role: ConnectionRole;
  added_by?: string;
  joined_at: string;
  updated_at: string;
}

// Connection invitation entity
export interface ConnectionInvitation {
  id: string;
  connection_id: string;
  invited_email: string;
  invited_user_id?: string;
  invited_by: string;
  role: ConnectionRole;
  status: InvitationStatus;
  token: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

// DTOs for API requests

export interface CreateConnectionRequest {
  name: string;
  description?: string;
  db_type: DatabaseType;
  config: ConnectionConfig;
}

export interface UpdateConnectionRequest {
  name?: string;
  description?: string;
  config?: ConnectionConfig;
  is_active?: boolean;
}

export interface InviteMemberRequest {
  email: string;
  role: ConnectionRole;
}

export interface UpdateMemberRoleRequest {
  role: ConnectionRole;
}

export interface AcceptInvitationRequest {
  invitation_id: string;
}

export interface DeclineInvitationRequest {
  invitation_id: string;
}

// Response types with populated data

export interface ConnectionWithRole extends DatabaseConnection {
  user_role: ConnectionRole;
  member_count?: number;
}

export interface ConnectionMemberWithUser extends ConnectionMember {
  user: {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export interface ConnectionWithMembers extends DatabaseConnection {
  members: ConnectionMemberWithUser[];
  user_role: ConnectionRole;
}

export interface InvitationWithDetails extends ConnectionInvitation {
  connection: {
    id: string;
    name: string;
    db_type: DatabaseType;
  };
  invited_by_user: {
    id: string;
    email: string;
    full_name?: string;
  };
}

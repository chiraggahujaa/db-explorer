// Types for database connections system

export type DatabaseType = 'mysql' | 'postgresql' | 'sqlite' | 'supabase';

export type ConnectionRole = 'owner' | 'admin' | 'developer' | 'tester' | 'viewer';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export type SchemaTrainingStatus = 'pending' | 'training' | 'completed' | 'failed';

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

// Schema cache types

export interface ColumnMetadata {
  name: string;
  type: string;
  nullable: boolean;
  default_value?: string;
  is_primary_key?: boolean;
  is_foreign_key?: boolean;
  extra?: string;
}

export interface IndexMetadata {
  name: string;
  column_name: string;
  is_unique: boolean;
  index_type?: string;
}

export interface ForeignKeyMetadata {
  column_name: string;
  referenced_table: string;
  referenced_column: string;
  constraint_name: string;
  update_rule?: string;
  delete_rule?: string;
}

export interface TableMetadata {
  name: string;
  schema: string;
  columns: ColumnMetadata[];
  indexes: IndexMetadata[];
  foreign_keys: ForeignKeyMetadata[];
  row_count?: number;
}

export interface SchemaMetadata {
  name: string;
  tables: TableMetadata[];
}

export interface CachedSchemaData {
  schemas: SchemaMetadata[];
  total_tables: number;
  total_columns: number;
  database_type: DatabaseType;
  version?: string;
}

export interface ConnectionSchemaCache {
  id: string;
  connection_id: string;
  schema_data: CachedSchemaData;
  training_status: SchemaTrainingStatus;
  training_started_at?: string;
  last_trained_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface TrainSchemaRequest {
  force?: boolean; // Force re-training even if recently trained
}

export interface TrainSchemaResponse {
  success: boolean;
  status: SchemaTrainingStatus;
  message: string;
  cache?: ConnectionSchemaCache;
}

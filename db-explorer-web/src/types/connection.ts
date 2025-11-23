// Types for database connections

export type DatabaseType = 'mysql' | 'postgresql' | 'sqlite' | 'supabase';

export type ConnectionRole = 'owner' | 'admin' | 'developer' | 'tester' | 'viewer';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

// Connection configurations
export interface BaseConnectionConfig {
  type: DatabaseType;
}

export interface SQLConnectionConfig extends BaseConnectionConfig {
  type: 'mysql' | 'postgresql';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export interface SQLiteConnectionConfig extends BaseConnectionConfig {
  type: 'sqlite';
  filePath: string;
}

export interface SupabaseConnectionConfig extends BaseConnectionConfig {
  type: 'supabase';
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  dbPassword?: string;
}

export type ConnectionConfig =
  | SQLConnectionConfig
  | SQLiteConnectionConfig
  | SupabaseConnectionConfig;

// Database connection entity
export interface DatabaseConnection {
  id: string;
  name: string;
  description?: string;
  dbType: DatabaseType;
  config: ConnectionConfig;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Connection with user role
export interface ConnectionWithRole extends DatabaseConnection {
  userRole: ConnectionRole;
  memberCount?: number;
}

// Connection member
export interface ConnectionMember {
  id: string;
  connectionId: string;
  userId: string;
  role: ConnectionRole;
  addedBy?: string;
  joinedAt: string;
  updatedAt: string;
}

// Connection member with user details
export interface ConnectionMemberWithUser extends ConnectionMember {
  user: {
    id: string;
    email: string;
    fullName?: string;
    avatarUrl?: string;
  };
}

// Connection with members
export interface ConnectionWithMembers extends DatabaseConnection {
  members: ConnectionMemberWithUser[];
  userRole: ConnectionRole;
}

// Connection invitation
export interface ConnectionInvitation {
  id: string;
  connectionId: string;
  invitedEmail: string;
  invitedUserId?: string;
  invitedBy: string;
  role: ConnectionRole;
  status: InvitationStatus;
  token: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

// Invitation with details
export interface InvitationWithDetails extends ConnectionInvitation {
  connection: {
    id: string;
    name: string;
    dbType: DatabaseType;
  };
  invitedByUser: {
    id: string;
    email: string;
    fullName?: string;
  };
}

// API request types
export interface CreateConnectionRequest {
  name: string;
  description?: string;
  dbType: DatabaseType;
  config: ConnectionConfig;
}

export interface UpdateConnectionRequest {
  name?: string;
  description?: string;
  config?: ConnectionConfig;
  isActive?: boolean;
}

export interface InviteMemberRequest {
  email?: string;
  emails?: string[];
  role: Exclude<ConnectionRole, 'owner'>;
}

export interface UpdateMemberRoleRequest {
  role: ConnectionRole;
}

// API response types
export interface ConnectionsResponse {
  success: boolean;
  data: {
    owned: ConnectionWithRole[];
    shared: ConnectionWithRole[];
  };
  error?: string;
}

export interface ConnectionResponse {
  success: boolean;
  data: ConnectionWithRole;
  message?: string;
}

export interface MembersResponse {
  success: boolean;
  data: ConnectionMemberWithUser[];
}

export interface InvitationsResponse {
  success: boolean;
  data: InvitationWithDetails[];
}

export interface InvitationResponse {
  success: boolean;
  data: ConnectionInvitation;
  message?: string;
  error?: string;
}

export interface ActionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Schema cache types
export interface ConnectionSchemaCache {
  id: string;
  connection_id: string;
  schemaData: any;
  lastTrainedAt?: string;
  training_status?: string;
  created_at: string;
  updated_at: string;
}

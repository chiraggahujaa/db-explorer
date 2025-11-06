export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface UpdatePasswordRequest {
  password: string;
  currentPassword?: string;
}

export interface VerifyEmailRequest {
  token: string;
  type: 'signup' | 'email' | 'recovery';
  email?: string;
}

// Minimal user/session/profile models used by auth responses
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  emailConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AuthSession = Record<string, unknown>;

export type UserProfile = Record<string, unknown>;

// Responses
export interface AuthResponse {
  success: boolean;
  data: {
    user: AuthUser | null;
    session: AuthSession | null;
  };
  message?: string;
}

export interface ProfileResponse {
  success: boolean;
  data: {
    user: AuthUser | null;
    profile: UserProfile | null;
  };
}

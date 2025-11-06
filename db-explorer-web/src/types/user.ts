export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUserProfile {
  userId: string;
  fullName: string | null;
  avatarUrl?: string | null;
  trustScore: number;
  isVerified: boolean;
  bio?: string | null;
  location?: { city?: string | null; state?: string | null } | null;
  createdAt: string;
}

export interface MeProfile {
  id: string;
  fullName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  gender?: string | null;
  dob?: string | null;
  dobVisibility?: 'private' | 'friends' | 'public' | null;
  trustScore?: number | null;
  isVerified?: boolean | null;
  avatarUrl?: string | null;
  bio?: string | null;
  isActive?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  location?: { city?: string | null; state?: string | null } | null;
}

export interface UpdateMeProfilePayload {
  fullName?: string;
  phoneNumber?: string;
  gender?: string;
  dob?: string;
  dobVisibility?: 'private' | 'friends' | 'public';
  bio?: string;
  avatarUrl?: string;
}



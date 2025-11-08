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
  phone?: string | null;
  gender?: string | null;
  dob?: string | null;
  trustScore?: number | null;
  isVerified?: boolean | null;
  emailVerified?: boolean | null;
  phoneVerified?: boolean | null;
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
  bio?: string;
}



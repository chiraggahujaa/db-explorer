'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { usersAPI } from '@/lib/api/users';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useMyProfile } from '@/features/profile/hooks/useProfile';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { cn } from '@/utils/ui';
import { User, Shield } from 'lucide-react';
import { DetailsTab } from '@/features/profile/components/tabs/DetailsTab';
import { SecurityTab } from '@/features/profile/components/tabs/SecurityTab';

type TabKey = 'details' | 'security';

const tabs = [
  { key: 'details' as TabKey, label: 'Profile Details', icon: User },
  { key: 'security' as TabKey, label: 'Security', icon: Shield },
];

export function ProfilePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const userId = params?.id as string;
  const [activeTab, setActiveTab] = useState<TabKey>('details');

  const isOwnProfile = user?.id === userId;

  // Fetch public profile if viewing someone else's profile
  const { data: publicProfileRes } = useQuery({
    queryKey: ['public-profile', userId],
    queryFn: () => usersAPI.getPublicProfile(userId),
    enabled: !!userId && !isOwnProfile,
  });

  // Fetch own profile if viewing own profile
  const { data: myProfileRes } = useMyProfile();

  const profile = isOwnProfile ? myProfileRes?.data : publicProfileRes?.data;

  useEffect(() => {
    if (!userId && user?.id) {
      window.location.href = `/profile/${user.id}`;
    }
  }, [userId, user]);

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  const initials = profile.fullName
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || 'U';

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Profile Header */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.avatarUrl || undefined} alt={profile.fullName || 'User'} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold">{profile.fullName || 'Anonymous User'}</h1>
              {isOwnProfile && myProfileRes?.data?.email && <p className="text-muted-foreground mt-1">{myProfileRes.data.email}</p>}
              {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Only show tabs for own profile */}
      {isOwnProfile && (
        <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6">
          {/* Sidebar with tabs */}
          <Card>
            <CardContent className="p-4">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                        activeTab === tab.key
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>

          {/* Tab content */}
          <div>
            {activeTab === 'details' && <DetailsTab />}
            {activeTab === 'security' && <SecurityTab />}
          </div>
        </div>
      )}

      {/* Public view (viewing someone else's profile) */}
      {!isOwnProfile && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Public profile view</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { usersAPI } from '@/lib/api/users';
import { UpdateMeProfilePayload } from '@/types/users-api';

export function useMyProfile() {
  return useQuery({
    queryKey: ['my-profile'],
    queryFn: () => usersAPI.getMeProfile(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateMeProfilePayload) => usersAPI.updateMeProfile(data),
    onSuccess: () => {
      // Invalidate both my-profile and public-profile queries
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      queryClient.invalidateQueries({ queryKey: ['public-profile'] });
      toast.success('Profile updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update profile');
    },
  });
}
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { DatePicker } from '@/components/forms/DatePicker';
import { useMyProfile, useUpdateProfile } from '@/features/profile/hooks/useProfile';
import { profileEditSchema, ProfileEditFormData } from '@/features/profile/validations/profileEdit';
import { Edit2, Check, X, CheckCircle2 } from 'lucide-react';

export function DetailsTab() {
  const [isEditMode, setIsEditMode] = useState(false);
  const { data: profileRes, isLoading } = useMyProfile();
  const updateProfileMutation = useUpdateProfile();
  
  const profile = profileRes?.data;

  const form = useForm<ProfileEditFormData>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      fullName: '',
      phoneNumber: '',
      gender: undefined,
      dob: '',
      bio: '',
    },
    mode: 'onChange',
  });

  // Update form when profile data loads or when entering edit mode
  useEffect(() => {
    if (profile) {
      form.reset({
        fullName: profile.fullName || '',
        phoneNumber: profile.phone || '',
        gender: profile.gender as 'male' | 'female' | 'other' | 'prefer_not_to_say' | undefined,
        dob: profile.dob || '',
        bio: profile.bio || '',
      });
    }
  }, [profile, form]);

  const onSubmit = async (data: ProfileEditFormData) => {
    try {
      await updateProfileMutation.mutateAsync(data);
      setIsEditMode(false);
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const handleCancel = () => {
    form.reset({
      fullName: profile?.fullName || '',
      phoneNumber: profile?.phone || '',
      gender: profile?.gender as 'male' | 'female' | 'other' | 'prefer_not_to_say' | undefined,
      dob: profile?.dob || '',
      bio: profile?.bio || '',
    });
    setIsEditMode(false);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Not provided';
    try {
      return format(new Date(dateString), 'PPP');
    } catch {
      return dateString;
    }
  };

  const formatGender = (gender: string | null | undefined) => {
    if (!gender) return 'Not provided';
    return gender.charAt(0).toUpperCase() + gender.slice(1).replace(/_/g, ' ');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Unable to load profile data</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Profile Details</h2>
          <p className="text-muted-foreground mt-1">
            View and manage your personal information
          </p>
        </div>
        {!isEditMode && (
          <Button
            variant="outline"
            onClick={() => setIsEditMode(true)}
            className="gap-2"
          >
            <Edit2 className="h-4 w-4" />
            Edit Profile
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditMode ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name*</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your full name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number*</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="Enter your phone number"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender*</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select your gender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                            <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dob"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth*</FormLabel>
                        <FormControl>
                          <DatePicker
                            value={field.value}
                            onChange={(date) => {
                              if (date) {
                                const year = date.getFullYear();
                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                const day = String(date.getDate()).padStart(2, '0');
                                const dateString = `${year}-${month}-${day}`;
                                field.onChange(dateString);
                              } else {
                                field.onChange('');
                              }
                            }}
                            placeholder="Select your date of birth"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell others a bit about yourself..."
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        {field.value?.length || 0}/500 characters
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3 justify-end pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={updateProfileMutation.isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateProfileMutation.isPending || !form.formState.isValid}
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <LoadingSpinner size={16} className="mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                  <p className="text-base">{profile.fullName || 'Not provided'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <div className="flex items-center gap-2">
                    <p className="text-base">{profile.email || 'Not provided'}</p>
                    {profile.emailVerified && (
                      <div title="Email verified">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Phone Number</p>
                  <div className="flex items-center gap-2">
                    <p className="text-base">{profile.phone || 'Not provided'}</p>
                    {profile.phoneVerified && (
                      <div title="Phone verified">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Gender</p>
                  <p className="text-base">{formatGender(profile.gender)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Date of Birth</p>
                  <p className="text-base">{formatDate(profile.dob)}</p>
                </div>
              </div>
              {profile.bio && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Bio</p>
                  <p className="text-base whitespace-pre-wrap">{profile.bio}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
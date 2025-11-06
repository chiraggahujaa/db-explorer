'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { userDetailsSchema, UserDetailsFormData } from '@/features/onboarding/validations/userDetailsSchema';
import { useUpdateProfile } from '@/features/profile/hooks/useProfile';
import { toast } from 'sonner';

interface UserDetailsTabProps {
  onComplete: () => void;
}

export function UserDetailsTab({ onComplete }: UserDetailsTabProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const updateProfileMutation = useUpdateProfile();

  const form = useForm<UserDetailsFormData>({
    resolver: zodResolver(userDetailsSchema),
    defaultValues: {
      fullName: '',
      phoneNumber: '',
      gender: undefined,
      dob: '',
      bio: '',
    },
    mode: 'onChange',
  });

  const onSubmit = async (data: UserDetailsFormData) => {
    setIsSubmitting(true);
    try {
      await updateProfileMutation.mutateAsync(data);
      toast.success('Profile updated successfully!');
      onComplete();
    } catch (error) {
      console.error('Profile update failed:', error);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Complete Your Profile</h2>
        <p className="text-muted-foreground mt-2">
          Help others get to know you better by filling out your profile details.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
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
                          // Convert Date to string format (YYYY-MM-DD) for form validation
                          if (date) {
                            const year = date.getFullYear()
                            const month = String(date.getMonth() + 1).padStart(2, '0')
                            const day = String(date.getDate()).padStart(2, '0')
                            const dateString = `${year}-${month}-${day}`
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

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting || !form.formState.isValid}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size={16} className="mr-2" />
                  Saving Profile...
                </>
              ) : (
                'Continue to KYC'
              )}
            </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
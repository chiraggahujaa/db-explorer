'use client';

import { useRouter } from 'next/navigation';
import { UserDetailsTab } from '@/features/onboarding/components/tabs/UserDetailsTab';
import { OnboardingStep } from '@/features/onboarding/types';

export function OnboardingPage() {
  const router = useRouter();

  const handleStepComplete = (step: OnboardingStep) => {
    // Complete onboarding after details step
    if (step === 'details') {
      handleOnboardingComplete();
    }
  };

  const handleOnboardingComplete = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome! Let&apos;s get you started</h1>
          <p className="text-gray-600">Complete your profile to get the most out of our platform</p>
        </div>

        {/* Step Content */}
        <div className="mb-8">
          <UserDetailsTab onComplete={() => handleStepComplete('details')} />
        </div>
      </div>
    </div>
  );
}
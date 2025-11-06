'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, User, Shield } from 'lucide-react';
import { cn } from '@/utils/ui';
import { UserDetailsTab } from '@/features/onboarding/components/tabs/UserDetailsTab';
import { KycTab } from '@/features/onboarding/components/tabs/KycTab';
import { OnboardingStep } from '@/features/onboarding/types';

const steps = [
  {
    key: 'details' as OnboardingStep,
    label: 'Personal Details',
    icon: User,
    description: 'Complete your profile information',
  },
  {
    key: 'kyc' as OnboardingStep,
    label: 'KYC Verification',
    icon: Shield,
    description: 'Verify your identity (optional)',
  },
];

export function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('details');
  const [completedSteps, setCompletedSteps] = useState<OnboardingStep[]>([]);
  const router = useRouter();

  const currentStepIndex = steps.findIndex(step => step.key === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleStepComplete = (step: OnboardingStep) => {
    const newCompletedSteps = [...completedSteps];
    if (!newCompletedSteps.includes(step)) {
      newCompletedSteps.push(step);
      setCompletedSteps(newCompletedSteps);
    }

    // Move to next step or complete onboarding
    if (step === 'details') {
      setCurrentStep('kyc');
    } else if (step === 'kyc') {
      handleOnboardingComplete();
    }
  };

  const handleOnboardingComplete = () => {
    router.push('/');
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'details':
        return <UserDetailsTab onComplete={() => handleStepComplete('details')} />;
      case 'kyc':
        return <KycTab onComplete={() => handleStepComplete('kyc')} />;
      default:
        return null;
    }
  };

  const isStepCompleted = (stepKey: OnboardingStep) => completedSteps.includes(stepKey);
  const isStepActive = (stepKey: OnboardingStep) => currentStep === stepKey;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome! Let&apos;s get you started</h1>
          <p className="text-gray-600">Complete your profile to get the most out of our platform</p>
        </div>

        {/* Progress Steps */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-600">Progress</span>
                <span className="text-sm font-medium text-gray-600">
                  Step {currentStepIndex + 1} of {steps.length}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              {steps.map((step) => {
                const StepIcon = step.icon;
                const isCompleted = isStepCompleted(step.key);
                const isActive = isStepActive(step.key);

                return (
                  <div
                    key={step.key}
                    className={cn(
                      'flex-1 p-4 rounded-lg border-2 transition-all duration-200',
                      isActive && 'border-blue-500 bg-blue-50',
                      isCompleted && !isActive && 'border-green-500 bg-green-50',
                      !isActive && !isCompleted && 'border-gray-200 bg-gray-50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full border-2',
                          isCompleted && 'border-green-500 bg-green-500 text-white',
                          isActive && !isCompleted && 'border-blue-500 bg-blue-500 text-white',
                          !isActive && !isCompleted && 'border-gray-300 bg-white text-gray-400'
                        )}
                      >
                        {isCompleted ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <StepIcon className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3
                          className={cn(
                            'font-medium',
                            isActive && 'text-blue-900',
                            isCompleted && !isActive && 'text-green-900',
                            !isActive && !isCompleted && 'text-gray-600'
                          )}
                        >
                          {step.label}
                        </h3>
                        <p
                          className={cn(
                            'text-sm',
                            isActive && 'text-blue-600',
                            isCompleted && !isActive && 'text-green-600',
                            !isActive && !isCompleted && 'text-gray-500'
                          )}
                        >
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        <div className="mb-8">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}
export type OnboardingStep = 'details';

export interface UserDetailsFormData {
  fullName: string;
  phoneNumber: string;
  gender: string;
  dob: string;
  bio: string;
}

export interface OnboardingProgress {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  isComplete: boolean;
}
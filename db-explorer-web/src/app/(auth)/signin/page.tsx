import { SignInForm } from '@/features/auth/components/SignInForm';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 dark:from-background dark:via-background dark:to-muted/10 p-4">
      <div className="w-full max-w-md">
        <SignInForm />
      </div>
    </div>
  );
}

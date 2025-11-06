import { SignInForm } from '@/features/auth/components/SignInForm';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <SignInForm />
      </div>
    </div>
  );
}

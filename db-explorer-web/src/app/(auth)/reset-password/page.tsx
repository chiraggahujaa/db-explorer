import { Suspense } from 'react';
import ResetPasswordContent from '@/features/auth/components/ResetPasswordContent';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-4">Loading…</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}

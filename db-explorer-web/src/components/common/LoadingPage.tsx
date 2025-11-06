import * as React from 'react';
import { LoadingSpinner } from './LoadingSpinner';

export interface LoadingPageProps {
  message?: string;
  size?: number;
}

export function LoadingPage({ message = 'Loading...', size = 32 }: LoadingPageProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4">
        <LoadingSpinner size={size} />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export default LoadingPage;
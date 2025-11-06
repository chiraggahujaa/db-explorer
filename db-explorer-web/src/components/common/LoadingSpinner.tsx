import * as React from 'react';
import { cn } from '@/utils/ui';

export interface LoadingSpinnerProps {
  size?: number; // pixel size
  className?: string;
  label?: string;
}

export function LoadingSpinner({ size = 24, className, label = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div role="status" aria-live="polite" className={cn('inline-flex items-center justify-center', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-2',
          'border-muted-foreground/20 border-t-foreground'
        )}
        style={{ width: size, height: size }}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export default LoadingSpinner;
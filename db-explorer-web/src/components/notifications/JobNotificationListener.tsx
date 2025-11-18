/**
 * JobNotificationListener Component
 *
 * Global component that listens for job notifications and displays
 * toast notifications when jobs complete, fail, or update.
 *
 * Add this component to your root layout:
 * ```tsx
 * <JobNotificationListener />
 * ```
 */

"use client";

import { useEffect } from 'react';
import { useJobNotifications } from '@/hooks/useNotifications';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';

export function JobNotificationListener() {
  useJobNotifications({
    onJobQueued: (jobId, jobType) => {
      console.log(`Job queued: ${jobType} (${jobId})`);
      toast.info('Job Queued', {
        description: `Your ${formatJobType(jobType)} job has been queued`,
        icon: <Clock className="w-4 h-4" />,
      });
    },

    onJobStarted: (jobId, jobType) => {
      console.log(`Job started: ${jobType} (${jobId})`);
      toast.info('Job Started', {
        description: `Processing ${formatJobType(jobType)}...`,
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
      });
    },

    onJobProgress: (jobId, jobType, progress) => {
      console.log(`Job progress: ${jobType} (${jobId}) - ${progress}%`);
      // Optional: Show progress updates
      // Only show major milestones to avoid spamming
      if (progress % 25 === 0) {
        toast.info('Job Progress', {
          description: `${formatJobType(jobType)}: ${progress}% complete`,
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
        });
      }
    },

    onJobCompleted: (jobId, jobType, result) => {
      console.log(`Job completed: ${jobType} (${jobId})`, result);

      // Customize based on job type
      if (jobType === 'schema_training') {
        toast.success('Schema Training Complete', {
          description: 'Your database schema has been successfully trained and cached.',
          icon: <CheckCircle2 className="w-4 h-4" />,
          duration: 5000,
        });
      } else {
        toast.success('Job Complete', {
          description: `${formatJobType(jobType)} completed successfully`,
          icon: <CheckCircle2 className="w-4 h-4" />,
          duration: 5000,
        });
      }
    },

    onJobFailed: (jobId, jobType, error) => {
      console.error(`Job failed: ${jobType} (${jobId})`, error);
      toast.error('Job Failed', {
        description: error || `Failed to process ${formatJobType(jobType)}`,
        icon: <XCircle className="w-4 h-4" />,
        duration: 10000,
      });
    },
  });

  // Component doesn't render anything
  return null;
}

/**
 * Format job type for display
 */
function formatJobType(jobType: string): string {
  return jobType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default JobNotificationListener;

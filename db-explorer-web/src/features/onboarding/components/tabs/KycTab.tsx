'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface KycTabProps {
  onComplete: () => void;
}

export function KycTab({ onComplete }: KycTabProps) {
  const [isSkipping, setIsSkipping] = useState(false);

  const handleSkip = async () => {
    setIsSkipping(true);
    
    // Simulate a brief delay for UX
    await new Promise(resolve => setTimeout(resolve, 500));
    
    toast.success('Onboarding completed! You can complete KYC later from your profile.');
    onComplete();
    setIsSkipping(false);
  };

  const handleCompleteKyc = () => {
    toast.info('KYC verification will be available soon!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">KYC Verification</h2>
        <p className="text-muted-foreground mt-2">
          Verify your identity to increase trust and unlock additional features.
        </p>
      </div>

      <div className="grid gap-6">
        {/* KYC Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-500" />
              Identity Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-8">
              <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">KYC Verification Coming Soon</h3>
              <p className="text-muted-foreground mb-6">
                We&apos;re working on bringing you a seamless identity verification experience. 
                This feature will be available shortly.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Enhanced security and trust
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Higher transaction limits
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Priority customer support
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleCompleteKyc}
                disabled
                className="flex-1"
                variant="outline"
              >
                Start KYC Verification
              </Button>
              <Button
                onClick={handleSkip}
                disabled={isSkipping}
                variant="default"
                className="flex-1"
              >
                {isSkipping ? 'Completing...' : 'Skip for Now'}
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              You can always complete KYC verification later from your profile settings.
            </p>
          </CardContent>
        </Card>

        {/* Benefits Card */}
        <Card>
          <CardHeader>
            <CardTitle>Why Complete KYC?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium">Build Trust</h4>
                  <p className="text-sm text-muted-foreground">
                    Verified users are more trusted by other community members
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium">Higher Limits</h4>
                  <p className="text-sm text-muted-foreground">
                    Access higher transaction limits and premium features
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium">Enhanced Security</h4>
                  <p className="text-sm text-muted-foreground">
                    Additional security measures protect your account and transactions
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
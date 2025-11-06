'use client';

import { Card, CardContent } from '@/components/ui/card';
import { User } from 'lucide-react';

export function DetailsTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">User Details</h2>
      <Card>
        <CardContent className="p-8 text-center">
          <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">User details section coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}
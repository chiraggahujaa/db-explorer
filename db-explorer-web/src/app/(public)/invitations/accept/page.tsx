"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { invitationsAPI } from "@/lib/api/connections";
import { toast } from "sonner";
import { Loader2, Database, CheckCircle, XCircle } from "lucide-react";
import type { InvitationWithDetails } from "@/types/connection";
import Link from "next/link";

export default function InvitationAcceptPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [invitation, setInvitation] = useState<InvitationWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [status, setStatus] = useState<"loading" | "loaded" | "accepted" | "declined" | "error">(
    "loading"
  );

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      setStatus("error");
      return;
    }

    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      const result = await invitationsAPI.getInvitationByToken(token);
      if (result.success && result.data) {
        // Map snake_case to camelCase if needed
        const inv = result.data as any;
        setInvitation({
          id: inv.id,
          connectionId: inv.connectionId || inv.connection_id,
          invitedEmail: inv.invitedEmail || inv.invited_email,
          invitedUserId: inv.invitedUserId || inv.invited_user_id,
          invitedBy: inv.invitedBy || inv.invited_by,
          role: inv.role,
          status: inv.status,
          token: inv.token,
          expiresAt: inv.expiresAt || inv.expires_at,
          createdAt: inv.createdAt || inv.created_at,
          updatedAt: inv.updatedAt || inv.updated_at,
          connection: inv.connection || {
            id: inv.connection?.id,
            name: inv.connection?.name,
            dbType: inv.connection?.dbType || inv.connection?.db_type,
          },
          invitedByUser: inv.invitedByUser || inv.invited_by_user || {
            id: inv.invited_by_user?.id,
            email: inv.invited_by_user?.email,
            fullName: inv.invited_by_user?.full_name,
          },
        });
        setStatus("loaded");
      } else {
        setStatus("error");
        toast.error(result.error || "Invitation not found");
      }
    } catch (error: any) {
      console.error("Load invitation error:", error);
      setStatus("error");
      if (error?.response?.status === 401) {
        toast.error("Please sign in to accept this invitation");
      } else {
        toast.error("Failed to load invitation");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token) return;

    setIsAccepting(true);
    try {
      const result = await invitationsAPI.acceptInvitationByToken(token);
      if (result.success) {
        setStatus("accepted");
        toast.success("Invitation accepted successfully");
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
      } else {
        toast.error(result.error || "Failed to accept invitation");
      }
    } catch (error: any) {
      console.error("Accept invitation error:", error);
      if (error?.response?.status === 401) {
        toast.error("Please sign in to accept this invitation");
        router.push(`/signin?redirect=/invitations/accept?token=${token}`);
      } else {
        toast.error(error?.response?.data?.error || "Failed to accept invitation");
      }
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!invitation) return;

    setIsDeclining(true);
    try {
      const result = await invitationsAPI.declineInvitation(invitation.id);
      if (result.success) {
        setStatus("declined");
        toast.success("Invitation declined");
      } else {
        toast.error(result.error || "Failed to decline invitation");
      }
    } catch (error: any) {
      console.error("Decline invitation error:", error);
      if (error?.response?.status === 401) {
        toast.error("Please sign in to decline this invitation");
        router.push(`/signin?redirect=/invitations/accept?token=${token}`);
      } else {
        toast.error(error?.response?.data?.error || "Failed to decline invitation");
      }
    } finally {
      setIsDeclining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error" || !invitation) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Invitation Not Found</CardTitle>
            <CardDescription>
              The invitation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button>Go to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "accepted") {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Invitation Accepted!</h2>
            <p className="text-muted-foreground mb-6">
              You have been added to {invitation.connection.name}
            </p>
            <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "declined") {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <XCircle className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Invitation Declined</h2>
            <p className="text-muted-foreground mb-6">
              You have declined the invitation to {invitation.connection.name}
            </p>
            <Link href="/">
              <Button>Go to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expirationDate = new Date(invitation.expiresAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const isExpired = new Date(invitation.expiresAt) < new Date();
  const canAccept = invitation.status === "pending" && !isExpired;

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-2xl mb-2">Database Connection Invitation</CardTitle>
              <CardDescription>
                You have been invited to access a database connection
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">{invitation.connection.name}</h3>
              <p className="text-sm text-muted-foreground">
                Invited by <span className="font-medium">
                  {invitation.invitedByUser?.fullName || invitation.invitedByUser?.email}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <p className="font-medium capitalize">{invitation.role}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expires</p>
                <p className="font-medium">{expirationDate}</p>
              </div>
            </div>

            {isExpired && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">
                  This invitation has expired on {expirationDate}
                </p>
              </div>
            )}

            {invitation.status !== "pending" && (
              <div className="rounded-lg border border-muted bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  This invitation has already been {invitation.status}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            {canAccept ? (
              <>
                <Button
                  onClick={handleAccept}
                  disabled={isAccepting || isDeclining}
                  className="flex-1"
                >
                  {isAccepting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    "Accept Invitation"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDecline}
                  disabled={isAccepting || isDeclining}
                >
                  {isDeclining ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Declining...
                    </>
                  ) : (
                    "Decline"
                  )}
                </Button>
              </>
            ) : (
              <Link href="/" className="flex-1">
                <Button variant="outline" className="w-full">
                  Go to Home
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


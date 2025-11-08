"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { invitationsAPI } from "@/lib/api/connections";
import { Loader2, Database } from "lucide-react";
import type { InvitationWithDetails } from "@/types/connection";

interface AcceptInvitationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FormData {
  token: string;
}

export function AcceptInvitationModal({
  open,
  onOpenChange,
  onSuccess,
}: AcceptInvitationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingInvitation, setIsLoadingInvitation] = useState(false);
  const [invitation, setInvitation] = useState<InvitationWithDetails | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      token: "",
    },
  });

  const token = watch("token");

  // Load invitation details when token changes
  const handleTokenChange = async (tokenValue: string) => {
    if (!tokenValue || tokenValue.length < 10) {
      setInvitation(null);
      return;
    }

    setIsLoadingInvitation(true);
    try {
      const result = await invitationsAPI.getInvitationByToken(tokenValue);
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
      } else {
        setInvitation(null);
      }
    } catch (error) {
      setInvitation(null);
    } finally {
      setIsLoadingInvitation(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const result = await invitationsAPI.acceptInvitationByToken(data.token);

      if (result.success) {
        toast.success("Invitation accepted successfully");
        handleSuccess();
      } else {
        toast.error(result.error || "Failed to accept invitation");
      }
    } catch (error: any) {
      console.error("Accept invitation error:", error);
      toast.error(error?.response?.data?.error || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setInvitation(null);
    onOpenChange(false);
  };

  const handleSuccess = () => {
    onSuccess();
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Accept Invitation</DialogTitle>
          <DialogDescription>
            Enter the invitation token to accept and join a database connection.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Invitation Token *</Label>
            <Input
              id="token"
              {...register("token", {
                required: "Token is required",
                minLength: {
                  value: 10,
                  message: "Token must be at least 10 characters",
                },
                onChange: (e) => {
                  handleTokenChange(e.target.value);
                },
              })}
              placeholder="Enter invitation token"
              className="font-mono text-sm"
            />
            {errors.token && (
              <p className="text-sm text-destructive">{errors.token.message}</p>
            )}
            {isLoadingInvitation && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading invitation details...</span>
              </div>
            )}
          </div>

          {invitation && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm">{invitation.connection.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Invited by {invitation.invitedByUser?.fullName || invitation.invitedByUser?.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Role: <span className="font-medium capitalize">{invitation.role}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {invitation && invitation.status !== "pending" && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">
                This invitation has already been {invitation.status}.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !invitation || invitation.status !== "pending"}
            >
              {isSubmitting ? "Accepting..." : "Accept Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { connectionsAPI } from "@/lib/api/connections";
import { Copy, Mail, Check } from "lucide-react";
import type { ConnectionWithRole, ConnectionRole } from "@/types/connection";

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionWithRole | null;
  onSuccess: () => void;
}

interface FormData {
  email: string;
  role: Exclude<ConnectionRole, "owner">;
}

export function InviteMemberModal({
  open,
  onOpenChange,
  connection,
  onSuccess,
}: InviteMemberModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      email: "",
      role: "developer",
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!connection) return;

    setIsSubmitting(true);
    try {
      const result = await connectionsAPI.inviteMember(connection.id, {
        email: data.email,
        role: data.role,
      });

      if (result.success && result.data) {
        setInvitationToken(result.data.token);
        setInvitationId(result.data.id);
        toast.success("Invitation created successfully");
      } else {
        toast.error(result.error || "Failed to create invitation");
      }
    } catch (error: any) {
      console.error("Invite member error:", error);
      toast.error(error?.response?.data?.error || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendEmail = async () => {
    if (!connection || !invitationId) return;

    setIsSendingEmail(true);
    try {
      const result = await connectionsAPI.sendInvitationEmail(
        connection.id,
        invitationId
      );

      if (result.success) {
        toast.success("Invitation email sent successfully");
      } else {
        toast.error(result.error || "Failed to send email");
      }
    } catch (error: any) {
      console.error("Send email error:", error);
      toast.error(error?.response?.data?.error || "Failed to send email");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleCopyToken = async () => {
    if (!invitationToken) return;

    try {
      await navigator.clipboard.writeText(invitationToken);
      setCopied(true);
      toast.success("Token copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy token");
    }
  };

  const handleClose = () => {
    reset();
    setInvitationToken(null);
    setInvitationId(null);
    setCopied(false);
    onOpenChange(false);
  };

  const handleSuccess = () => {
    onSuccess();
    handleClose();
  };

  // Show success state with token
  if (invitationToken) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invitation Created</DialogTitle>
            <DialogDescription>
              Share this token with the invited user or send them an email.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Invitation Token</Label>
              <div className="flex gap-2">
                <Input
                  id="token"
                  value={invitationToken}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyToken}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The user can enter this token in the "Accept Invitation" modal
                or click the link in the email.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleSendEmail}
                disabled={isSendingEmail}
                className="flex-1"
              >
                <Mail className="mr-2 h-4 w-4" />
                {isSendingEmail ? "Sending..." : "Send Email"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSuccess}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show invitation form
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
          <DialogDescription>
            Invite a user to access {connection?.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: "Invalid email address",
                },
              })}
              placeholder="user@example.com"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select
              onValueChange={(value) =>
                setValue("role", value as Exclude<ConnectionRole, "owner">)
              }
              defaultValue="developer"
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="developer">Developer</SelectItem>
                <SelectItem value="tester">Tester</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-sm text-destructive">{errors.role.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


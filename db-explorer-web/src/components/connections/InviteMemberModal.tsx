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
import { toast } from "sonner";
import { connectionsAPI } from "@/lib/api/connections";
import { Plus, X, Mail, Check, Copy, Loader2, AlertCircle } from "lucide-react";
import type { ConnectionWithRole, ConnectionRole } from "@/types/connection";

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionWithRole | null;
  onSuccess: () => void;
}

interface EmailEntry {
  id: string;
  email: string;
  emailError?: string;
}

interface InvitationResult {
  email: string;
  success: boolean;
  error?: string;
  token?: string;
  id?: string;
}

export function InviteMemberModal({
  open,
  onOpenChange,
  connection,
  onSuccess,
}: InviteMemberModalProps) {
  const [emails, setEmails] = useState<EmailEntry[]>([
    { id: crypto.randomUUID(), email: "" },
  ]);
  const [role, setRole] = useState<Exclude<ConnectionRole, "owner">>("developer");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<InvitationResult[]>([]);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [copiedTokenIndex, setCopiedTokenIndex] = useState<number | null>(null);

  const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

  const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) {
      return "Email is required";
    }
    if (!emailRegex.test(email)) {
      return "Invalid email address";
    }
    return undefined;
  };

  const addEmail = () => {
    setEmails([...emails, { id: crypto.randomUUID(), email: "" }]);
  };

  const removeEmail = (id: string) => {
    if (emails.length > 1) {
      setEmails(emails.filter((email) => email.id !== id));
    }
  };

  const updateEmail = (id: string, value: string) => {
    setEmails(
      emails.map((email) => {
        if (email.id === id) {
          const updated = { ...email, email: value };
          const error = validateEmail(value);
          return { ...updated, emailError: error };
        }
        return email;
      })
    );
  };

  const validateAll = (): boolean => {
    let isValid = true;
    const updated = emails.map((email) => {
      const error = validateEmail(email.email);
      if (error) {
        isValid = false;
      }
      return { ...email, emailError: error };
    });
    setEmails(updated);
    return isValid;
  };

  const handleCopyToken = async (token: string, index: number) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedTokenIndex(index);
      toast.success("Token copied to clipboard");
      setTimeout(() => setCopiedTokenIndex(null), 2000);
    } catch (error) {
      toast.error("Failed to copy token");
    }
  };

  const onSubmit = async () => {
    if (!connection) return;

    if (!validateAll()) {
      toast.error("Please fix validation errors before submitting");
      return;
    }

    setIsSubmitting(true);
    setResults([]);

    try {
      const emailList = emails.map((e) => e.email.trim()).filter((e) => e);

      const result = await connectionsAPI.inviteMember(connection.id, {
        emails: emailList,
        role,
      });

      if (result.success && "data" in result && result.data) {
        const bulkResult = result.data as {
          invitations: Array<{ id: string; token: string; invitedEmail: string }>;
          errors: Array<{ email: string; error: string }>;
        };

        // Map results
        const invitationResults: InvitationResult[] = [];

        // Add successful invitations
        bulkResult.invitations.forEach((inv) => {
          invitationResults.push({
            email: inv.invitedEmail,
            success: true,
            token: inv.token,
            id: inv.id,
          });
        });

        // Add errors
        bulkResult.errors.forEach((err) => {
          invitationResults.push({
            email: err.email,
            success: false,
            error: err.error,
          });
        });

        setResults(invitationResults);

        const successCount = bulkResult.invitations.length;
        const errorCount = bulkResult.errors.length;

        if (successCount > 0) {
          toast.success(
            `Successfully created ${successCount} invitation(s)${
              errorCount > 0 ? `, ${errorCount} failed` : ""
            }`
          );
        } else {
          toast.error("Failed to create invitations");
        }
      } else {
        toast.error(result.error || "Failed to create invitations");
      }
    } catch (error: any) {
      console.error("Invite member error:", error);
      toast.error(error?.response?.data?.error || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendEmails = async () => {
    if (!connection) return;

    const successfulInvitations = results.filter((r) => r.success && r.id);
    if (successfulInvitations.length === 0) {
      toast.error("No successful invitations to send emails for");
      return;
    }

    setIsSendingEmails(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      await Promise.all(
        successfulInvitations.map(async (result) => {
          if (!result.id) return;
          try {
            const emailResult = await connectionsAPI.sendInvitationEmail(
              connection.id,
              result.id
            );
            if (emailResult.success) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch {
            errorCount++;
          }
        })
      );

      if (successCount > 0) {
        toast.success(
          `Successfully sent ${successCount} email(s)${
            errorCount > 0 ? `, ${errorCount} failed` : ""
          }`
        );
      } else {
        toast.error("Failed to send emails");
      }
    } catch (error) {
      console.error("Send emails error:", error);
      toast.error("Failed to send emails");
    } finally {
      setIsSendingEmails(false);
    }
  };

  const handleClose = () => {
    setEmails([{ id: crypto.randomUUID(), email: "" }]);
    setRole("developer");
    setResults([]);
    setIsSubmitting(false);
    setIsSendingEmails(false);
    setCopiedTokenIndex(null);
    onOpenChange(false);
  };

  const handleSuccess = () => {
    onSuccess();
    handleClose();
  };

  // Show results state with tokens
  if (results.length > 0) {
    const successfulInvitations = results.filter((r) => r.success);
    const failedInvitations = results.filter((r) => !r.success);
    const hasSuccessful = successfulInvitations.length > 0;
    const hasFailed = failedInvitations.length > 0;

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Invitation Created</DialogTitle>
            <DialogDescription>
              {hasSuccessful && (
                <span className="text-green-600 font-medium">
                  {successfulInvitations.length} invitation(s) created successfully
                </span>
              )}
              {hasFailed && (
                <span className="text-destructive ml-2">
                  {failedInvitations.length} invitation(s) could not be created
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Show tokens for successful invitations */}
            {hasSuccessful && (
              <div className="space-y-4">
                <Label className="text-base font-semibold">
                  Invitation Token{successfulInvitations.length > 1 ? "s" : ""}
                </Label>
                <p className="text-sm text-muted-foreground">
                  Share {successfulInvitations.length > 1 ? "these tokens" : "this token"} with the invited user{successfulInvitations.length > 1 ? "s" : ""} or send them an email.
                </p>
                
                <div className="space-y-3">
                  {successfulInvitations.map((invitation, index) => (
                    <div key={index} className="space-y-2">
                      {successfulInvitations.length > 1 && (
                        <Label className="text-sm font-medium text-muted-foreground">
                          {invitation.email}
                        </Label>
                      )}
                      <div className="flex gap-2">
                        <Input
                          value={invitation.token || ""}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleCopyToken(invitation.token!, index)}
                          className="flex-shrink-0"
                        >
                          {copiedTokenIndex === index ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Show failed invitations */}
            {hasFailed && (
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <Label className="text-base font-semibold text-amber-900">
                      Could not create invitations for the following email(s):
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      These users are already members of this connection or there was an error.
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2 pl-7">
                  {failedInvitations.map((failed, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg bg-amber-50 border border-amber-200"
                    >
                      <p className="font-medium text-amber-900">
                        {failed.email}
                      </p>
                      {failed.error && (
                        <p className="text-sm text-amber-700 mt-1">
                          {failed.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {hasSuccessful && (
              <Button
                type="button"
                onClick={handleSendEmails}
                disabled={isSendingEmails}
                className="flex-1 sm:flex-initial"
              >
                <Mail className="mr-2 h-4 w-4" />
                {isSendingEmails ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  `Send ${successfulInvitations.length} Email(s)`
                )}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleSuccess}
              className="flex-1 sm:flex-initial"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Show invitation form
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Invite Members</DialogTitle>
          <DialogDescription>
            Invite one or more users to access {connection?.name} with the same role
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Role selector - single for all emails */}
          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select
              value={role}
              onValueChange={(value) =>
                setRole(value as Exclude<ConnectionRole, "owner">)
              }
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
            <p className="text-xs text-muted-foreground">
              This role will be applied to all invited users
            </p>
          </div>

          {/* Email inputs */}
          <div className="space-y-4">
            <Label>Email Addresses *</Label>
            <div className="max-h-[300px] overflow-y-auto pr-4 space-y-3">
              {emails.map((emailEntry, index) => (
                <div
                  key={emailEntry.id}
                  className="flex items-start gap-2"
                >
                  <div className="flex-1">
                    <Input
                      type="email"
                      value={emailEntry.email}
                      onChange={(e) =>
                        updateEmail(emailEntry.id, e.target.value)
                      }
                      placeholder="user@example.com"
                      className={
                        emailEntry.emailError ? "border-destructive" : ""
                      }
                    />
                    {emailEntry.emailError && (
                      <p className="text-sm text-destructive mt-1">
                        {emailEntry.emailError}
                      </p>
                    )}
                  </div>
                  {emails.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEmail(emailEntry.id)}
                      className="flex-shrink-0 mt-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={addEmail}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Another Email
            </Button>
          </div>
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
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || emails.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              `Create ${emails.length} Invitation${emails.length !== 1 ? "s" : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { connectionsAPI } from "@/lib/api/connections";
import type { ConnectionWithRole } from "@/types/connection";

interface DeleteConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ConnectionWithRole | null;
  onSuccess: () => void;
}

export function DeleteConnectionModal({
  open,
  onOpenChange,
  connection,
  onSuccess,
}: DeleteConnectionModalProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const isConfirmed = confirmationText === connection?.name;

  const handleDelete = async () => {
    if (!connection || !isConfirmed) return;

    setIsDeleting(true);
    try {
      const result = await connectionsAPI.deleteConnection(connection.id);
      if (result.success) {
        toast.success("Connection deleted successfully");
        onSuccess();
        onOpenChange(false);
        setConfirmationText("");
      } else {
        toast.error(result.error || "Failed to delete connection");
      }
    } catch (error: any) {
      console.error("Delete connection error:", error);
      toast.error(error?.response?.data?.error || "An error occurred");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      onOpenChange(false);
      setConfirmationText("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>Delete Connection</DialogTitle>
              <DialogDescription className="mt-1">
                This action cannot be undone.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            This will permanently delete the connection{" "}
            <span className="font-semibold text-foreground">
              {connection?.name}
            </span>
            . All associated data and member access will be removed.
          </p>

          <div className="space-y-2">
            <Label htmlFor="confirmation">
              Type <span className="font-semibold">{connection?.name}</span> to
              confirm:
            </Label>
            <Input
              id="confirmation"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder={connection?.name}
              disabled={isDeleting}
              className="font-mono"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Connection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Database, Loader2, UserPlus } from "lucide-react";
import { ConnectionCard } from "@/components/connections/ConnectionCard";
import { ConnectionModal } from "@/components/connections/ConnectionModal";
import { DeleteConnectionModal } from "@/components/connections/DeleteConnectionModal";
import { InviteMemberModal } from "@/components/connections/InviteMemberModal";
import { AcceptInvitationModal } from "@/components/connections/AcceptInvitationModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { connectionsAPI } from "@/lib/api/connections";
import { toast } from "sonner";
import type { ConnectionWithRole } from "@/types/connection";

export default function DashboardPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
  const [isRemoveSharedOpen, setIsRemoveSharedOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] =
    useState<ConnectionWithRole | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["connections"],
    queryFn: async () => {
      const result = await connectionsAPI.getMyConnections(true);
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch connections");
      }
      return result.data;
    },
  });

  const handleAddClick = () => {
    setSelectedConnection(null);
    setIsAddModalOpen(true);
  };

  const handleEdit = (connection: ConnectionWithRole) => {
    setSelectedConnection(connection);
    setIsEditModalOpen(true);
  };

  const handleDelete = (connection: ConnectionWithRole) => {
    setSelectedConnection(connection);
    setIsDeleteModalOpen(true);
  };

  const handleInvite = (connection: ConnectionWithRole) => {
    setSelectedConnection(connection);
    setIsInviteModalOpen(true);
  };

  const handleRemoveShared = (connection: ConnectionWithRole) => {
    setSelectedConnection(connection);
    setIsRemoveSharedOpen(true);
  };

  const confirmRemoveShared = async () => {
    if (!selectedConnection) return;

    try {
      const result = await connectionsAPI.leaveSharedConnection(selectedConnection.id);
      if (result.success) {
        toast.success("Successfully removed from shared connections");
        handleSuccess();
      } else {
        toast.error(result.error || "Failed to remove shared connection");
      }
    } catch (error: any) {
      console.error("Error removing shared connection:", error);
      toast.error(error.message || "Failed to remove shared connection");
    } finally {
      setIsRemoveSharedOpen(false);
      setSelectedConnection(null);
    }
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["connections"] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive">
            Failed to load connections. Please try again.
          </p>
        </div>
      </div>
    );
  }

  const ownedConnections = data?.owned || [];
  const sharedConnections = data?.shared || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* My Connections Section */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Connections</h1>
            <p className="text-muted-foreground mt-1">
              Manage your database connections
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setIsAcceptModalOpen(true)}
              size="lg"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Accept Invitation
            </Button>
            <Button onClick={handleAddClick} size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Add Connection
            </Button>
          </div>
        </div>

        {ownedConnections.length === 0 ? (
          <div className="border-2 border-dashed rounded-lg p-12 text-center">
            <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No connections yet</h3>
            <p className="text-muted-foreground mb-4">
              Get started by adding your first database connection
            </p>
            <Button onClick={handleAddClick}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Connection
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ownedConnections.map((connection) => (
              <ConnectionCard
                key={connection.id}
                connection={connection}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onInvite={handleInvite}
              />
            ))}
          </div>
        )}
      </div>

      {/* Shared Connections Section */}
      {sharedConnections.length > 0 && (
        <div className="mb-12">
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight">Shared Connections</h2>
            <p className="text-muted-foreground mt-1">
              Connections shared with you by other team members
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sharedConnections.map((connection) => (
              <ConnectionCard
                key={connection.id}
                connection={connection}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onInvite={handleInvite}
                onRemove={handleRemoveShared}
                isShared={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <ConnectionModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        connection={null}
        onSuccess={handleSuccess}
      />

      <ConnectionModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        connection={selectedConnection}
        onSuccess={handleSuccess}
      />

      <DeleteConnectionModal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        connection={selectedConnection}
        onSuccess={handleSuccess}
      />

      <InviteMemberModal
        open={isInviteModalOpen}
        onOpenChange={setIsInviteModalOpen}
        connection={selectedConnection}
        onSuccess={handleSuccess}
      />

      <AcceptInvitationModal
        open={isAcceptModalOpen}
        onOpenChange={setIsAcceptModalOpen}
        onSuccess={handleSuccess}
      />

      <AlertDialog open={isRemoveSharedOpen} onOpenChange={setIsRemoveSharedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Shared Connection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove &quot;{selectedConnection?.name}&quot; from your shared connections?
              You will no longer have access to this connection unless you are invited again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveShared} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

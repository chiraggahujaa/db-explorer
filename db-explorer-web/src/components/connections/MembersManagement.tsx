"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { connectionsAPI } from "@/lib/api/connections";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2, Crown, Shield, Code, TestTube, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ConnectionWithRole, ConnectionMemberWithUser, ConnectionRole } from "@/types/connection";
import { InviteMemberModal } from "./InviteMemberModal";

interface MembersManagementProps {
  connection: ConnectionWithRole;
}

const roleIcons: Record<ConnectionRole, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: Shield,
  developer: Code,
  tester: TestTube,
  viewer: Eye,
};

const roleColors: Record<ConnectionRole, string> = {
  owner: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800/50",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800/50",
  developer: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300 border-green-200 dark:border-green-800/50",
  tester: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800/50",
  viewer: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300 border-gray-200 dark:border-gray-700/50",
};

const roleDescriptions: Record<ConnectionRole, string> = {
  owner: "Full control of the connection",
  admin: "Can manage members and settings",
  developer: "Can read and write data",
  tester: "Can read and execute queries",
  viewer: "Read-only access",
};

export function MembersManagement({ connection }: MembersManagementProps) {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<ConnectionMemberWithUser | null>(null);
  const [updatingRoleForMember, setUpdatingRoleForMember] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const canManageMembers = connection.userRole === "owner" || connection.userRole === "admin";

  const { data: membersData, isLoading } = useQuery({
    queryKey: ["connection-members", connection.id],
    queryFn: async () => {
      const result = await connectionsAPI.getConnectionMembers(connection.id);
      if (!result.success) {
        throw new Error(result.data as any || "Failed to fetch members");
      }
      return result.data;
    },
  });

  const handleRoleChange = async (member: ConnectionMemberWithUser, newRole: ConnectionRole) => {
    if (member.role === "owner" || newRole === "owner") {
      toast.error("Cannot change owner role");
      return;
    }

    setUpdatingRoleForMember(member.id);
    try {
      const result = await connectionsAPI.updateMemberRole(connection.id, member.id, { role: newRole });
      if (result.success) {
        toast.success(`Updated ${member.user.email}'s role to ${newRole}`);
        queryClient.invalidateQueries({ queryKey: ["connection-members", connection.id] });
      } else {
        toast.error(result.error || "Failed to update role");
      }
    } catch (error: any) {
      console.error("Error updating member role:", error);
      toast.error(error.message || "Failed to update role");
    } finally {
      setUpdatingRoleForMember(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    try {
      const result = await connectionsAPI.removeMember(connection.id, memberToRemove.id);
      if (result.success) {
        toast.success(`Removed ${memberToRemove.user.email} from connection`);
        queryClient.invalidateQueries({ queryKey: ["connection-members", connection.id] });
        setMemberToRemove(null);
      } else {
        toast.error(result.error || "Failed to remove member");
      }
    } catch (error: any) {
      console.error("Error removing member:", error);
      toast.error(error.message || "Failed to remove member");
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || "??";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const members = membersData || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Connection Members</h2>
          <p className="text-muted-foreground mt-1">
            Manage who has access to this connection
          </p>
        </div>
        {canManageMembers && (
          <Button onClick={() => setIsInviteModalOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
          <CardDescription>
            People who have access to this connection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member) => {
              const RoleIcon = roleIcons[member.role];
              const isCurrentUserOwner = connection.userRole === "owner";
              const canEditThisMember =
                canManageMembers &&
                member.role !== "owner" &&
                !(member.role === "admin" && connection.userRole !== "owner");

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.user.avatarUrl} alt={member.user.fullName || member.user.email} />
                      <AvatarFallback>
                        {getInitials(member.user.fullName, member.user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {member.user.fullName || member.user.email}
                        </p>
                        {member.role === "owner" && (
                          <Crown className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {member.user.email}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-4">
                    {canEditThisMember && updatingRoleForMember !== member.id ? (
                      <Select
                        value={member.role}
                        onValueChange={(value) => handleRoleChange(member, value as ConnectionRole)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              Admin
                            </div>
                          </SelectItem>
                          <SelectItem value="developer">
                            <div className="flex items-center gap-2">
                              <Code className="h-4 w-4" />
                              Developer
                            </div>
                          </SelectItem>
                          <SelectItem value="tester">
                            <div className="flex items-center gap-2">
                              <TestTube className="h-4 w-4" />
                              Tester
                            </div>
                          </SelectItem>
                          <SelectItem value="viewer">
                            <div className="flex items-center gap-2">
                              <Eye className="h-4 w-4" />
                              Viewer
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : updatingRoleForMember === member.id ? (
                      <div className="w-[140px] flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : (
                      <Badge variant="outline" className={roleColors[member.role]}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </Badge>
                    )}

                    {canEditThisMember && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMemberToRemove(member)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {members.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No members found
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Role Permissions Guide */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>
            Understanding what each role can do
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Object.entries(roleDescriptions) as [ConnectionRole, string][]).map(([role, description]) => {
              const RoleIcon = roleIcons[role];
              return (
                <div key={role} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className={`p-2 rounded-lg ${roleColors[role]}`}>
                    <RoleIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium capitalize">{role}</p>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <InviteMemberModal
        open={isInviteModalOpen}
        onOpenChange={setIsInviteModalOpen}
        connection={connection}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["connection-members", connection.id] });
        }}
      />

      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToRemove?.user.email} from this connection?
              They will lose all access to this database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

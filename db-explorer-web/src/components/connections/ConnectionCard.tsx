"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Edit, Trash2, UserPlus, Database, X, RefreshCw } from "lucide-react";
import type { ConnectionWithRole, ConnectionRole } from "@/types/connection";

interface ConnectionCardProps {
  connection: ConnectionWithRole;
  onEdit: (connection: ConnectionWithRole) => void;
  onDelete: (connection: ConnectionWithRole) => void;
  onInvite: (connection: ConnectionWithRole) => void;
  onRetrain: (connection: ConnectionWithRole) => void;
  onRemove?: (connection: ConnectionWithRole) => void;
  isShared?: boolean;
}

export function ConnectionCard({
  connection,
  onEdit,
  onDelete,
  onInvite,
  onRetrain,
  onRemove,
  isShared = false,
}: ConnectionCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Helper to get user role (handles both camelCase and snake_case from API)
  const getUserRole = (conn: ConnectionWithRole & { user_role?: ConnectionRole }): ConnectionRole => {
    return conn.userRole || (conn as any).user_role || 'viewer';
  };

  const getDbTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      mysql: "MySQL",
      postgresql: "PostgreSQL",
      sqlite: "SQLite",
      supabase: "Supabase",
    };
    return labels[type] || type;
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      owner: "bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/50",
      admin: "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/50",
      developer: "bg-green-100 text-green-700 border border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800/50",
      tester: "bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-800/50",
      viewer: "bg-muted text-muted-foreground border border-border",
    };
    return colors[role] || "bg-muted text-muted-foreground border border-border";
  };

  return (
    <Link
      href={`/dashboard/connections/${connection.id}`}
      className="block h-full"
      onClick={() => console.log('[ConnectionCard] Link clicked for:', connection.id, connection.name)}
    >
      <Card
        className="hover:shadow-md transition-shadow duration-200 cursor-pointer group h-full flex flex-col border-border hover:border-primary/20"
      >
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 dark:from-primary dark:to-primary/70 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Database className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-semibold truncate text-foreground">
                {connection.name}
              </CardTitle>
              {connection.description && (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {connection.description}
                  </p>
                </div>
              )}
            </div>
          </div>
          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-accent"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onInvite(connection);
                  setIsMenuOpen(false);
                }}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Invite
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit(connection);
                  setIsMenuOpen(false);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onRetrain(connection);
                  setIsMenuOpen(false);
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Re-train Schema
              </DropdownMenuItem>
              {isShared && onRemove && getUserRole(connection) !== "owner" && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemove(connection);
                    setIsMenuOpen(false);
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Remove
                </DropdownMenuItem>
              )}
              {(getUserRole(connection) === "owner" || getUserRole(connection) === "admin") && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(connection);
                    setIsMenuOpen(false);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20 dark:bg-primary/20 dark:text-primary dark:border-primary/30">
            {getDbTypeLabel(connection.dbType)}
          </span>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${getRoleBadgeColor(
              getUserRole(connection)
            )}`}
          >
            {getUserRole(connection).charAt(0).toUpperCase() + getUserRole(connection).slice(1)}
          </span>
          {!connection.isActive && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground border border-border">
              Inactive
            </span>
          )}
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}


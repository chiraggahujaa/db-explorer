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
import { MoreVertical, Edit, Trash2, UserPlus, Database, X } from "lucide-react";
import type { ConnectionWithRole } from "@/types/connection";

interface ConnectionCardProps {
  connection: ConnectionWithRole;
  onEdit: (connection: ConnectionWithRole) => void;
  onDelete: (connection: ConnectionWithRole) => void;
  onInvite: (connection: ConnectionWithRole) => void;
  onRemove?: (connection: ConnectionWithRole) => void;
  isShared?: boolean;
}

export function ConnectionCard({
  connection,
  onEdit,
  onDelete,
  onInvite,
  onRemove,
  isShared = false,
}: ConnectionCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
      owner: "bg-purple-100 text-purple-700",
      admin: "bg-blue-100 text-blue-700",
      developer: "bg-green-100 text-green-700",
      tester: "bg-yellow-100 text-yellow-700",
      viewer: "bg-gray-100 text-gray-700",
    };
    return colors[role] || "bg-gray-100 text-gray-700";
  };

  return (
    <Link
      href={`/dashboard/connections/${connection.id}`}
      className="block h-full"
      onClick={() => console.log('[ConnectionCard] Link clicked for:', connection.id, connection.name)}
    >
      <Card
        className="hover:shadow-md transition-shadow cursor-pointer group h-full flex flex-col"
      >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-semibold truncate">
                {connection.name}
              </CardTitle>
              <div className="h-10 mt-1">
                {connection.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {connection.description}
                  </p>
                )}
              </div>
            </div>
          </div>
          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
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
              {isShared && onRemove && connection.userRole !== "owner" && (
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
              {(connection.userRole === "owner" || connection.userRole === "admin") && (
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
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            {getDbTypeLabel(connection.dbType)}
          </span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
              connection.userRole
            )}`}
          >
            {connection.userRole.charAt(0).toUpperCase() + connection.userRole.slice(1)}
          </span>
          {!connection.isActive && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              Inactive
            </span>
          )}
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}


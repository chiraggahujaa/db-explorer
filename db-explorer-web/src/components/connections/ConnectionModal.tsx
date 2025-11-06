"use client";

import { useState, useEffect } from "react";
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
import type {
  DatabaseType,
  ConnectionConfig,
  ConnectionWithRole,
  CreateConnectionRequest,
  UpdateConnectionRequest,
} from "@/types/connection";

interface ConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection?: ConnectionWithRole | null;
  onSuccess: () => void;
}

interface FormData {
  name: string;
  description: string;
  dbType: DatabaseType;
  // SQL config fields
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  // SQLite config fields
  filePath?: string;
  // Supabase config fields
  url?: string;
  anonKey?: string;
  serviceRoleKey?: string;
  dbPassword?: string;
}

export function ConnectionModal({
  open,
  onOpenChange,
  connection,
  onSuccess,
}: ConnectionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      name: "",
      description: "",
      dbType: "mysql",
      ssl: false,
    },
  });

  const dbType = watch("dbType");

  useEffect(() => {
    if (connection && open) {
      // Populate form with connection data
      // Backend returns camelCase, but config might have snake_case keys
      const config = connection.config as any;
      reset({
        name: connection.name,
        description: connection.description || "",
        dbType: connection.dbType,
        // Handle both camelCase and snake_case from backend
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        password: config.password,
        ssl: config.ssl,
        filePath: config.filePath || config.file_path,
        url: config.url,
        anonKey: config.anonKey || config.anon_key,
        serviceRoleKey: config.serviceRoleKey || config.service_role_key,
        dbPassword: config.dbPassword || config.db_password,
      });
    } else if (!connection && open) {
      // Reset form for new connection
      reset({
        name: "",
        description: "",
        dbType: "mysql",
        ssl: false,
      });
    }
  }, [connection, open, reset]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      let config: ConnectionConfig;

      if (data.dbType === "sqlite") {
        config = {
          type: "sqlite",
          file_path: data.filePath!,
        } as any; // Backend expects snake_case for config
      } else if (data.dbType === "supabase") {
        config = {
          type: "supabase",
          url: data.url!,
          anon_key: data.anonKey!,
          service_role_key: data.serviceRoleKey!,
          db_password: data.dbPassword,
        } as any; // Backend expects snake_case for config
      } else {
        config = {
          type: data.dbType as "mysql" | "postgresql",
          host: data.host!,
          port: data.port!,
          database: data.database!,
          username: data.username!,
          password: data.password!,
          ssl: data.ssl,
        };
      }

      if (connection) {
        // Update existing connection
        const updateData: any = {
          name: data.name,
          description: data.description || undefined,
          config,
        };
        const result = await connectionsAPI.updateConnection(connection.id, updateData);
        if (result.success) {
          toast.success("Connection updated successfully");
          onSuccess();
          onOpenChange(false);
        } else {
          toast.error(result.error || "Failed to update connection");
        }
      } else {
        // Create new connection
        const createData: any = {
          name: data.name,
          description: data.description || undefined,
          db_type: data.dbType, // Backend expects snake_case
          config,
        };
        const result = await connectionsAPI.createConnection(createData);
        if (result.success) {
          toast.success("Connection created successfully");
          onSuccess();
          onOpenChange(false);
        } else {
          toast.error(result.error || "Failed to create connection");
        }
      }
    } catch (error: any) {
      console.error("Connection save error:", error);
      toast.error(error?.response?.data?.error || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderConfigFields = () => {
    if (dbType === "sqlite") {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="filePath">File Path *</Label>
            <Input
              id="filePath"
              {...register("filePath", { required: "File path is required" })}
              placeholder="/path/to/database.db"
            />
            {errors.filePath && (
              <p className="text-sm text-destructive">{errors.filePath.message}</p>
            )}
          </div>
        </div>
      );
    }

    if (dbType === "supabase") {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Supabase URL *</Label>
            <Input
              id="url"
              type="url"
              {...register("url", { required: "Supabase URL is required" })}
              placeholder="https://your-project.supabase.co"
            />
            {errors.url && (
              <p className="text-sm text-destructive">{errors.url.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="anonKey">Anon Key *</Label>
            <Input
              id="anonKey"
              type="password"
              {...register("anonKey", { required: "Anon key is required" })}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            />
            {errors.anonKey && (
              <p className="text-sm text-destructive">{errors.anonKey.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="serviceRoleKey">Service Role Key *</Label>
            <Input
              id="serviceRoleKey"
              type="password"
              {...register("serviceRoleKey", {
                required: "Service role key is required",
              })}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            />
            {errors.serviceRoleKey && (
              <p className="text-sm text-destructive">{errors.serviceRoleKey.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dbPassword">Database Password (Optional)</Label>
            <Input
              id="dbPassword"
              type="password"
              {...register("dbPassword")}
              placeholder="Database password"
            />
          </div>
        </div>
      );
    }

    // MySQL/PostgreSQL fields
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="host">Host *</Label>
            <Input
              id="host"
              {...register("host", { required: "Host is required" })}
              placeholder="localhost"
            />
            {errors.host && (
              <p className="text-sm text-destructive">{errors.host.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="port">Port *</Label>
            <Input
              id="port"
              type="number"
              {...register("port", {
                required: "Port is required",
                valueAsNumber: true,
                min: { value: 1, message: "Port must be at least 1" },
                max: { value: 65535, message: "Port must be at most 65535" },
              })}
              placeholder={dbType === "mysql" ? "3306" : "5432"}
            />
            {errors.port && (
              <p className="text-sm text-destructive">{errors.port.message}</p>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="database">Database Name *</Label>
          <Input
            id="database"
            {...register("database", { required: "Database name is required" })}
            placeholder="mydatabase"
          />
          {errors.database && (
            <p className="text-sm text-destructive">{errors.database.message}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username *</Label>
            <Input
              id="username"
              {...register("username", { required: "Username is required" })}
              placeholder="root"
            />
            {errors.username && (
              <p className="text-sm text-destructive">{errors.username.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <Input
              id="password"
              type="password"
              {...register("password", { required: "Password is required" })}
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="ssl"
            {...register("ssl")}
            className="rounded border-gray-300"
          />
          <Label htmlFor="ssl" className="cursor-pointer">
            Enable SSL
          </Label>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {connection ? "Edit Connection" : "Add New Connection"}
          </DialogTitle>
          <DialogDescription>
            {connection
              ? "Update your database connection settings"
              : "Configure a new database connection to get started"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Connection Name *</Label>
            <Input
              id="name"
              {...register("name", { required: "Connection name is required" })}
              placeholder="My Production Database"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              {...register("description")}
              placeholder="Optional description for this connection"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dbType">Database Type *</Label>
            <Select
              value={dbType}
              onValueChange={(value) => setValue("dbType", value as DatabaseType)}
            >
              <SelectTrigger id="dbType">
                <SelectValue placeholder="Select database type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="postgresql">PostgreSQL</SelectItem>
                <SelectItem value="sqlite">SQLite</SelectItem>
                <SelectItem value="supabase">Supabase</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {renderConfigFields()}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : connection ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


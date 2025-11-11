"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { connectionsAPI } from "@/lib/api/connections";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ExplorerSidebar } from "@/components/connections/ExplorerSidebar";
import { ChatInterface } from "@/components/connections/ChatInterface";
import { ConnectionExplorerProvider } from "@/contexts/ConnectionExplorerContext";

export default function ConnectionExplorerPage() {
  const params = useParams();
  const connectionId = params.id as string;

  const { data: connection, isLoading: isLoadingConnection } = useQuery({
    queryKey: ["connection", connectionId],
    queryFn: async () => {
      const result = await connectionsAPI.getConnection(connectionId);
      if (!result.success) {
        throw new Error(result.message || "Failed to fetch connection");
      }
      return result.data;
    },
    enabled: !!connectionId,
  });

  if (isLoadingConnection) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive">Connection not found</p>
        </div>
      </div>
    );
  }

  return (
    <ConnectionExplorerProvider>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Left Sidebar */}
        <ExplorerSidebar initialConnectionId={connectionId} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatInterface connection={connection} />
        </div>
      </div>
    </ConnectionExplorerProvider>
  );
}


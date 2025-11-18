"use client";

import { useCallback, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { connectionsAPI } from "@/lib/api/connections";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ExplorerSidebar } from "@/components/connections/ExplorerSidebar";
import { ChatInterface } from "@/components/connections/ChatInterface";
import { MembersManagement } from "@/components/connections/MembersManagement";
import { ConnectionExplorerProvider } from "@/contexts/ConnectionExplorerContext";
import { getClaudeService } from "@/services/ClaudeService";
import { useMCPStore } from "@/stores/useMCPStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Users } from "lucide-react";

export default function ConnectionExplorerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const connectionId = params.id as string;
  const chatSessionIdFromUrl = searchParams.get("chatId");
  const tabFromUrl = searchParams.get("tab") || "chat";

  console.log('[ConnectionExplorerPage] Rendering with:', {
    connectionId,
    chatSessionIdFromUrl,
    tabFromUrl,
    paramsId: params.id,
  });

  const [activeChatSessionId, setActiveChatSessionId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  const { data: connection, isLoading: isLoadingConnection, error: connectionError } = useQuery({
    queryKey: ["connection", connectionId],
    queryFn: async () => {
      console.log('[ConnectionExplorerPage] Fetching connection:', connectionId);
      const result = await connectionsAPI.getConnection(connectionId);
      console.log('[ConnectionExplorerPage] Connection result:', result);
      if (!result.success) {
        throw new Error("Failed to fetch connection");
      }
      return result.data;
    },
    enabled: !!connectionId,
    retry: 1,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Sync activeChatSessionId with URL parameter
  useEffect(() => {
    // Update state whenever URL chatId changes (including when it's removed)
    setActiveChatSessionId(chatSessionIdFromUrl || undefined);
  }, [chatSessionIdFromUrl]);

  // Sync activeTab with URL parameter
  useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value === "chat") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const newUrl = params.toString()
      ? `/dashboard/connections/${connectionId}?${params.toString()}`
      : `/dashboard/connections/${connectionId}`;
    router.push(newUrl);
  };

  const handleNewChat = useCallback(() => {
    if (!connectionId) {
      return;
    }

    try {
      const claudeService = getClaudeService();
      claudeService.clearHistory();
    } catch (error) {
      console.warn("[ConnectionExplorerPage] Unable to clear Claude history:", error);
    }

    try {
      // Clear only the streaming messages and permissions, not the MCP connection itself
      useMCPStore.getState().clearMCPState(connectionId);
      useMCPStore.getState().clearCurrentChat();
    } catch (error) {
      console.error("[ConnectionExplorerPage] Failed to clear MCP state:", error);
    }

    // Clear chatId from URL - this will trigger ChatInterface to start fresh
    router.push(`/dashboard/connections/${connectionId}`);
    setActiveChatSessionId(undefined);
    // Don't remount - just let the URL change trigger the reset
    // setChatSessionKey((prev) => prev + 1);
  }, [connectionId, router]);

  const handleSelectChat = useCallback((chatSessionId: string) => {
    if (!chatSessionId) {
      // Clear chat if empty string is passed - navigate to new chat view
      router.push(`/dashboard/connections/${connectionId}`);
      setActiveChatSessionId(undefined);
      return;
    }

    // Navigate to existing chat - the URL change will trigger ChatInterface to load it
    // ChatInterface effect will handle clearing old state and loading new chat
    router.push(`/dashboard/connections/${connectionId}?chatId=${chatSessionId}`);
    setActiveChatSessionId(chatSessionId);
  }, [connectionId, router]);

  console.log('[ConnectionExplorerPage] State:', {
    isLoadingConnection,
    hasConnection: !!connection,
    hasError: !!connectionError,
    connectionName: connection?.name,
  });

  if (isLoadingConnection) {
    console.log('[ConnectionExplorerPage] Showing loading state');
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    );
  }

  if (connectionError) {
    console.error('[ConnectionExplorerPage] Showing error state:', connectionError);
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive font-semibold mb-2">Failed to load connection</p>
          <p className="text-sm text-muted-foreground">{(connectionError as Error).message}</p>
        </div>
      </div>
    );
  }

  if (!connection) {
    console.warn('[ConnectionExplorerPage] No connection found');
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive">Connection not found</p>
        </div>
      </div>
    );
  }

  console.log('[ConnectionExplorerPage] Rendering main content for connection:', connection.name);

  // Only show Members tab for owners
  const canManageMembers = connection.userRole === "owner";

  return (
    <ConnectionExplorerProvider key={connectionId}>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full flex flex-col">
        {/* Tab Navigation */}
        <div className="border-b bg-background px-6 py-2">
          <TabsList className={`grid w-full max-w-md ${canManageMembers ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat
            </TabsTrigger>
            {canManageMembers && (
              <TabsTrigger value="members" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Members
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Chat Tab */}
        <TabsContent value="chat" className="flex-1 overflow-hidden mt-0">
          <div className="flex h-full overflow-hidden">
            {/* Left Sidebar */}
            <ExplorerSidebar
              initialConnectionId={connectionId}
              onNewChat={handleNewChat}
              onSelectChat={handleSelectChat}
              currentChatSessionId={activeChatSessionId}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <ChatInterface
                connection={connection}
                chatSessionId={activeChatSessionId}
              />
            </div>
          </div>
        </TabsContent>

        {/* Members Tab */}
        {canManageMembers && (
          <TabsContent value="members" className="flex-1 overflow-auto mt-0">
            <MembersManagement connection={connection} />
          </TabsContent>
        )}
      </Tabs>
    </ConnectionExplorerProvider>
  );
}


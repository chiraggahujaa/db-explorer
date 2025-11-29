"use client";

import { useCallback, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { connectionsAPI } from "@/lib/api/connections";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ExplorerSidebar } from "@/components/connections/ExplorerSidebar";
import { ChatInterfaceNew as ChatInterface } from "@/components/connections/ChatInterfaceNew";
import { ConnectionExplorerProvider } from "@/contexts/ConnectionExplorerContext";
import { useChatStore } from "@/stores/useChatStore";

export default function ConnectionExplorerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const connectionId = params.id as string;
  const chatSessionIdFromUrl = searchParams.get("chatId");

  const [activeChatSessionId, setActiveChatSessionId] = useState<string | undefined>(undefined);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [chatSessionKey, setChatSessionKey] = useState<string>('initial');

  const { data: connection, isLoading: isLoadingConnection, error: connectionError } = useQuery({
    queryKey: ["connection", connectionId],
    queryFn: async () => {
      const result = await connectionsAPI.getConnection(connectionId);
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

  const handleNewChat = useCallback(() => {
    if (!connectionId) {
      return;
    }

    try {
      // Clear current chat state
      useChatStore.getState().clearCurrentChat();
    } catch (error) {
      console.error("[ConnectionExplorerPage] Failed to clear chat state:", error);
    }

    // Generate new unique key to force complete component remount
    const newKey = `session-${Date.now()}`;
    setChatSessionKey(newKey);

    // Clear chatId from URL - this will trigger ChatInterface to start fresh
    router.push(`/dashboard/connections/${connectionId}`);
    setActiveChatSessionId(undefined);
  }, [connectionId, router]);

  const handleSelectChat = useCallback((chatSessionId: string) => {
    if (!chatSessionId) {
      // Clear chat if empty string is passed - navigate to new chat view
      useChatStore.getState().clearCurrentChat();
      const newKey = `session-${Date.now()}`;
      setChatSessionKey(newKey);
      router.push(`/dashboard/connections/${connectionId}`);
      setActiveChatSessionId(undefined);
      return;
    }

    // Navigate to existing chat - the URL change will trigger ChatInterface to load it
    // ChatInterface effect will handle clearing old state and loading new chat
    router.push(`/dashboard/connections/${connectionId}?chatId=${chatSessionId}`);
    setActiveChatSessionId(chatSessionId);
  }, [connectionId, router]);

  if (isLoadingConnection) {
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

  return (
    <ConnectionExplorerProvider key={connectionId}>
      <div className="flex h-full overflow-hidden">
        {/* Left Sidebar */}
        <ExplorerSidebar
          initialConnectionId={connectionId}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          currentChatSessionId={activeChatSessionId}
          isOpen={isLeftSidebarOpen}
          onToggle={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
        />

        {/* Main Content Area - Chat interface will render right sidebar */}
        <div className="flex-1 flex overflow-hidden">
          <ChatInterface
            key={chatSessionKey}
            connection={connection}
            chatSessionId={activeChatSessionId}
            onNewChat={handleNewChat}
          />
        </div>
      </div>
    </ConnectionExplorerProvider>
  );
}


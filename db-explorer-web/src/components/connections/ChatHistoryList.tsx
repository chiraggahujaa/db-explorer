"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Trash2, Clock, Loader2 } from "lucide-react";
import { chatSessionsAPI, type ChatSession } from "@/lib/api/chatSessions";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/utils/ui";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface ChatHistoryListProps {
  connectionId: string;
  onSelectChat: (chatSessionId: string) => void;
  currentChatSessionId?: string | null;
  excludeSessionId?: string | null; // Session ID to exclude from the list (e.g., newly created session in "new chat" view)
}

export function ChatHistoryList({
  connectionId,
  onSelectChat,
  currentChatSessionId,
  excludeSessionId,
}: ChatHistoryListProps) {
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [chatToDelete, setChatToDelete] = useState<{ id: string; title: string } | null>(null);

  // Fetch chat sessions for this connection
  const {
    data: chatSessions,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["chat-sessions", connectionId],
    queryFn: async () => {
      console.log('[ChatHistoryList] Fetching chat sessions for connection:', connectionId);
      const result = await chatSessionsAPI.getChatSessionsByConnection(connectionId);
      console.log('[ChatHistoryList] Chat sessions result:', result);
      if (!result.success) {
        throw new Error("Failed to fetch chat sessions");
      }
      return result.data;
    },
    enabled: !!connectionId,
    retry: 1, // Only retry once to avoid long delays
    staleTime: 30000, // Cache for 30 seconds
  });

  const handleDeleteClick = (chatSessionId: string, chatTitle: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent chat selection when clicking delete
    setChatToDelete({ id: chatSessionId, title: chatTitle });
  };

  const handleConfirmDelete = async () => {
    if (!chatToDelete) return;

    setDeletingChatId(chatToDelete.id);
    try {
      await chatSessionsAPI.deleteChatSession(chatToDelete.id);
      toast.success("Chat deleted successfully");
      refetch();

      // If we deleted the current chat, clear it
      if (chatToDelete.id === currentChatSessionId) {
        // Notify parent to clear current chat
        onSelectChat("");
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
      toast.error("Failed to delete chat");
    } finally {
      setDeletingChatId(null);
      setChatToDelete(null);
    }
  };

  const formatChatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return "Unknown time";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Filter out the excluded session (newly created session in "new chat" view)
  const filteredChatSessions = chatSessions?.filter(
    (chat) => !excludeSessionId || chat.id !== excludeSessionId
  );

  if (!filteredChatSessions || filteredChatSessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No chat history yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Start a conversation to see it here
        </p>
      </div>
    );
  }

  return (
    <>
      <AlertDialog open={!!chatToDelete} onOpenChange={(open) => !open && setChatToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{chatToDelete?.title || 'Untitled Chat'}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-2 py-2">
        {filteredChatSessions.map((chat) => (
        <div
          key={chat.id}
          className={cn(
            "group relative flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors",
            "hover:bg-accent/50",
            currentChatSessionId === chat.id && "bg-accent"
          )}
          onClick={() => onSelectChat(chat.id)}
        >
          <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />

          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-medium truncate">
              {chat.title || "Untitled Chat"}
            </p>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatChatTime(chat.lastMessageAt)}</span>
            </div>

            {chat.selectedSchema && (
              <p className="text-xs text-muted-foreground truncate">
                Schema: {chat.selectedSchema}
                {chat.selectedTables && chat.selectedTables.length > 0 && (
                  <span className="ml-1">
                    ({chat.selectedTables.length} {chat.selectedTables.length === 1 ? 'table' : 'tables'})
                  </span>
                )}
              </p>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0",
              deletingChatId === chat.id && "opacity-100"
            )}
            onClick={(e) => handleDeleteClick(chat.id, chat.title || "Untitled Chat", e)}
            disabled={deletingChatId === chat.id}
          >
            {deletingChatId === chat.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 text-destructive" />
            )}
          </Button>
        </div>
      ))}
      </div>
    </>
  );
}

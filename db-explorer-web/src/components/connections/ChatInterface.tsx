"use client";

import { useState, FormEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConnectionWithRole } from "@/types/connection";

interface ChatInterfaceProps {
  connection: ConnectionWithRole;
}

export function ChatInterface({ connection }: ChatInterfaceProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    
    // TODO: Implement chat functionality with MCP server
    console.log("Sending message:", message);
    
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setMessage("");
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-6">
        <h1 className="text-2xl font-bold">{connection.name}</h1>
        {connection.description && (
          <p className="text-muted-foreground mt-1">{connection.description}</p>
        )}
      </div>

      {/* Chat Content Area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-2xl">
          <h2 className="text-3xl font-bold mb-4">
            Ask questions about your database
          </h2>
          <p className="text-lg text-muted-foreground">
            Use natural language to explore your database schema, query data, and get insights.
          </p>
        </div>
      </div>

      {/* Chat Input */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask a question about your database..."
            className="flex-1"
            disabled={isSubmitting}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!message.trim() || isSubmitting}
            className="shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </div>
    </div>
  );
}


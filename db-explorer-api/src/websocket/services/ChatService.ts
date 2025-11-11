/**
 * Chat Service
 * Core business logic for chat functionality
 */

import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, TypingIndicator } from '../types/socket.js';
import { MessageQueue } from './MessageQueue.js';
import { PresenceService } from './PresenceService.js';
import { supabaseAdmin } from '../../lib/supabase.js';

export class ChatService {
  private messageQueue: MessageQueue;
  private presenceService: PresenceService;
  private messageHistory: Map<string, ChatMessage[]> = new Map(); // connectionId -> messages

  constructor() {
    this.messageQueue = new MessageQueue();
    this.presenceService = new PresenceService();
  }

  /**
   * Process incoming chat message
   */
  async processMessage(
    userId: string,
    messageId: string,
    content: string,
    connectionId: string,
    context?: ChatMessage['context']
  ): Promise<ChatMessage> {
    // Validate connection belongs to user (check both created_by and connection_members)
    const { data: memberCheck } = await supabaseAdmin
      .from('connection_members')
      .select('connection_id')
      .eq('connection_id', connectionId)
      .eq('user_id', userId)
      .maybeSingle();

    // Also check if user is the creator
    const { data: creatorCheck } = await supabaseAdmin
      .from('database_connections')
      .select('id, created_by')
      .eq('id', connectionId)
      .eq('created_by', userId)
      .maybeSingle();

    // User must be either a member or the creator
    if (!memberCheck && !creatorCheck) {
      throw new Error('Connection not found or access denied');
    }

    const message: ChatMessage = {
      messageId,
      userId,
      connectionId,
      content,
      ...(context && { context }),
      timestamp: Date.now(),
      status: 'sent',
    };

    // Store in history
    if (!this.messageHistory.has(connectionId)) {
      this.messageHistory.set(connectionId, []);
    }
    this.messageHistory.get(connectionId)!.push(message);

    // Keep only last 100 messages per connection
    const history = this.messageHistory.get(connectionId)!;
    if (history.length > 100) {
      history.shift();
    }

    // TODO: Process message with db-mcp here
    // For now, we'll just return the message
    // In the future: await this.processWithMCP(message);

    return message;
  }

  /**
   * Get message history for a connection
   */
  getMessageHistory(connectionId: string, limit: number = 50): ChatMessage[] {
    const history = this.messageHistory.get(connectionId) || [];
    return history.slice(-limit);
  }

  /**
   * Create typing indicator
   */
  createTypingIndicator(
    userId: string,
    connectionId: string,
    isTyping: boolean
  ): TypingIndicator {
    return {
      userId,
      connectionId,
      isTyping,
      timestamp: Date.now(),
    };
  }

  /**
   * Get message queue service
   */
  getMessageQueue(): MessageQueue {
    return this.messageQueue;
  }

  /**
   * Get presence service
   */
  getPresenceService(): PresenceService {
    return this.presenceService;
  }

  /**
   * Process message with db-mcp (placeholder for future implementation)
   */
  private async processWithMCP(message: ChatMessage): Promise<ChatMessage> {
    // TODO: Integrate with db-mcp
    // This will be implemented when db-mcp integration is ready
    return message;
  }
}

// Singleton instance
let chatServiceInstance: ChatService | null = null;

export const getChatService = (): ChatService => {
  if (!chatServiceInstance) {
    chatServiceInstance = new ChatService();
  }
  return chatServiceInstance;
};


/**
 * Message Queue Service
 * Handles offline message queuing and retry logic
 */

import type { ChatMessage } from '../types/socket.js';

interface QueuedMessage extends ChatMessage {
  retryCount: number;
  lastRetryAt?: number;
}

export class MessageQueue {
  private queue: Map<string, QueuedMessage> = new Map();
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  /**
   * Add message to queue
   */
  enqueue(message: ChatMessage): void {
    const queuedMessage: QueuedMessage = {
      ...message,
      retryCount: 0,
    };
    this.queue.set(message.messageId, queuedMessage);
  }

  /**
   * Remove message from queue
   */
  dequeue(messageId: string): QueuedMessage | undefined {
    const message = this.queue.get(messageId);
    if (message) {
      this.queue.delete(messageId);
    }
    return message;
  }

  /**
   * Get all queued messages
   */
  getAll(): QueuedMessage[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get messages ready for retry
   */
  getRetryable(): QueuedMessage[] {
    const now = Date.now();
    return Array.from(this.queue.values()).filter((message) => {
      if (message.retryCount >= this.maxRetries) {
        return false;
      }
      if (!message.lastRetryAt) {
        return true;
      }
      return now - message.lastRetryAt >= this.retryDelay * Math.pow(2, message.retryCount);
    });
  }

  /**
   * Increment retry count for a message
   */
  incrementRetry(messageId: string): boolean {
    const message = this.queue.get(messageId);
    if (!message) {
      return false;
    }

    message.retryCount++;
    message.lastRetryAt = Date.now();
    message.status = 'pending';

    if (message.retryCount >= this.maxRetries) {
      message.status = 'error';
      message.error = 'Max retries exceeded';
    }

    return message.retryCount < this.maxRetries;
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue.clear();
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.size;
  }
}


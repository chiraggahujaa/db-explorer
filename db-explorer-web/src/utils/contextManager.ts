/**
 * Context Window Manager
 * Manages the token/message context window for AI conversations
 * Implements sliding window with summarization for old messages
 */

import type { ChatMessage } from '@/lib/api/chatSessions';

export interface ContextWindow {
  messages: ChatMessage[];
  totalTokens: number;
  percentageUsed: number;
  needsSummarization: boolean;
  summarizedContext?: string;
}

export interface ContextManagerConfig {
  maxTokens: number; // Maximum tokens for context window
  tokensPerMessage: number; // Average tokens per message (estimation)
  summaryThreshold: number; // Percentage at which to trigger summarization (e.g., 80)
  minMessagesToKeep: number; // Minimum recent messages to always keep
}

// Default configuration
const DEFAULT_CONFIG: ContextManagerConfig = {
  maxTokens: 30000, // ~30K tokens for Gemini 2.5 Flash
  tokensPerMessage: 150, // Conservative estimate
  summaryThreshold: 80, // Start summarizing at 80% capacity
  minMessagesToKeep: 10, // Always keep last 10 messages
};

export class ContextManager {
  private config: ContextManagerConfig;

  constructor(config: Partial<ContextManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Estimate tokens for a message
   * Uses a simple heuristic: ~4 characters per token
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate total tokens for messages
   */
  private calculateTotalTokens(messages: ChatMessage[]): number {
    return messages.reduce((total, msg) => {
      const contentTokens = this.estimateTokens(msg.content);
      // Add extra tokens for tool calls if present
      const toolCallTokens = msg.toolCalls
        ? this.estimateTokens(JSON.stringify(msg.toolCalls))
        : 0;
      return total + contentTokens + toolCallTokens;
    }, 0);
  }

  /**
   * Get context window status for current chat history
   */
  public getContextWindow(chatHistory: ChatMessage[]): ContextWindow {
    const totalTokens = this.calculateTotalTokens(chatHistory);
    const percentageUsed = Math.min(
      100,
      Math.round((totalTokens / this.config.maxTokens) * 100)
    );
    const needsSummarization =
      percentageUsed >= this.config.summaryThreshold &&
      chatHistory.length > this.config.minMessagesToKeep;

    return {
      messages: chatHistory,
      totalTokens,
      percentageUsed,
      needsSummarization,
    };
  }

  /**
   * Prepare messages for AI context
   * Returns recent messages + optional summary of older messages
   */
  public prepareContextForAI(
    chatHistory: ChatMessage[],
    systemSummary?: string
  ): {
    messages: ChatMessage[];
    summaryPrefix?: string;
  } {
    const contextWindow = this.getContextWindow(chatHistory);

    // If we don't need summarization, return all messages
    if (!contextWindow.needsSummarization) {
      return { messages: chatHistory };
    }

    // Calculate how many messages we can keep
    const recentMessages = chatHistory.slice(-this.config.minMessagesToKeep);
    const oldMessages = chatHistory.slice(0, -this.config.minMessagesToKeep);

    // If there's a system summary, use it as prefix
    if (systemSummary && oldMessages.length > 0) {
      return {
        messages: recentMessages,
        summaryPrefix: systemSummary,
      };
    }

    // Otherwise, create a simple summary of old messages
    const summaryPrefix = this.createSimpleSummary(oldMessages);

    return {
      messages: recentMessages,
      summaryPrefix,
    };
  }

  /**
   * Create a simple summary of messages
   * (This is a fallback - ideally use AI to generate summaries)
   */
  private createSimpleSummary(messages: ChatMessage[]): string {
    if (messages.length === 0) return '';

    const userMessages = messages.filter((m) => m.role === 'user');
    const toolCalls = messages
      .filter((m) => m.role === 'assistant' && m.toolCalls)
      .flatMap((m) => m.toolCalls || []);

    const queryCount = toolCalls.length;
    const topicSample = userMessages
      .slice(0, 3)
      .map((m) => m.content.slice(0, 50))
      .join(', ');

    return `Previous conversation context: Discussed topics including "${topicSample}...". Executed ${queryCount} database queries. [${messages.length} messages summarized]`;
  }

  /**
   * Convert chat history to AI provider format
   */
  public formatForAIProvider(
    chatHistory: ChatMessage[],
    providerType: 'gemini' | 'claude'
  ): any[] {
    if (providerType === 'gemini') {
      return chatHistory.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));
    } else if (providerType === 'claude') {
      return chatHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
    }
    return [];
  }

  /**
   * Check if context window is nearing capacity
   */
  public isNearingCapacity(chatHistory: ChatMessage[]): boolean {
    const contextWindow = this.getContextWindow(chatHistory);
    return contextWindow.percentageUsed >= this.config.summaryThreshold;
  }

  /**
   * Get configuration
   */
  public getConfig(): ContextManagerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ContextManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
let contextManager: ContextManager | null = null;

export const getContextManager = (
  config?: Partial<ContextManagerConfig>
): ContextManager => {
  if (!contextManager) {
    contextManager = new ContextManager(config);
  } else if (config) {
    contextManager.updateConfig(config);
  }
  return contextManager;
};

export const resetContextManager = (): void => {
  contextManager = null;
};

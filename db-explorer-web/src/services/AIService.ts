/**
 * AI Service Abstraction Layer
 * Provides a unified interface for different AI providers (Claude, Gemini)
 */

import { getClaudeService, ClaudeService, type ClaudeStreamEvent } from './ClaudeService';
import { getGeminiService, GeminiService, type GeminiStreamEvent } from './GeminiService';

// Unified stream event type
export interface AIStreamEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'error' | 'done';
  content?: string;
  toolName?: string;
  toolInput?: any;
  toolResult?: any;
  toolCallId?: string; // Unique ID for this tool call
  thinking?: string;
  error?: string;
}

export type AIStreamCallback = (event: AIStreamEvent) => void;

// AI Provider type
export type AIProvider = 'claude' | 'gemini';

/**
 * AI Service Interface
 */
export interface IAIService {
  sendMessageWithSystem(
    userMessage: string,
    systemPrompt: string,
    connectionId: string,
    selectedDatabase: string | null,
    onStream?: AIStreamCallback
  ): Promise<void>;
  
  clearHistory(): void;
  getHistory(): any[];
}

/**
 * Claude Service Adapter
 */
class ClaudeServiceAdapter implements IAIService {
  private service: ClaudeService;

  constructor(apiKey?: string) {
    this.service = getClaudeService(apiKey);
  }

  async sendMessageWithSystem(
    userMessage: string,
    systemPrompt: string,
    connectionId: string,
    selectedDatabase: string | null,
    onStream?: AIStreamCallback
  ): Promise<void> {
    await this.service.sendMessageWithSystem(
      userMessage,
      systemPrompt,
      connectionId,
      selectedDatabase,
      (event: ClaudeStreamEvent) => {
        // Convert Claude events to unified format
        onStream?.(event as AIStreamEvent);
      }
    );
  }

  clearHistory(): void {
    this.service.clearHistory();
  }

  getHistory(): any[] {
    return this.service.getHistory();
  }
}

/**
 * Gemini Service Adapter
 */
class GeminiServiceAdapter implements IAIService {
  private service: GeminiService;

  constructor(apiKey?: string) {
    this.service = getGeminiService(apiKey);
  }

  async sendMessageWithSystem(
    userMessage: string,
    systemPrompt: string,
    connectionId: string,
    selectedDatabase: string | null,
    onStream?: AIStreamCallback
  ): Promise<void> {
    await this.service.sendMessageWithSystem(
      userMessage,
      systemPrompt,
      connectionId,
      selectedDatabase,
      (event: GeminiStreamEvent) => {
        // Convert Gemini events to unified format
        onStream?.(event as AIStreamEvent);
      }
    );
  }

  clearHistory(): void {
    this.service.clearHistory();
  }

  getHistory(): any[] {
    return this.service.getHistory();
  }
}

/**
 * AI Service Factory
 */
class AIServiceFactory {
  private static instance: IAIService | null = null;
  private static currentProvider: AIProvider | null = null;

  static getService(provider?: AIProvider): IAIService {
    // Determine which provider to use
    const selectedProvider = provider || this.getConfiguredProvider();

    // If provider changed, reset instance
    if (this.currentProvider !== selectedProvider) {
      this.instance = null;
      this.currentProvider = selectedProvider;
    }

    // Create instance if needed
    if (!this.instance) {
      switch (selectedProvider) {
        case 'gemini':
          console.log('[AIService] Using Gemini provider');
          this.instance = new GeminiServiceAdapter();
          break;
        case 'claude':
          console.log('[AIService] Using Claude provider');
          this.instance = new ClaudeServiceAdapter();
          break;
        default:
          throw new Error(`Unknown AI provider: ${selectedProvider}`);
      }
    }

    return this.instance;
  }

  private static getConfiguredProvider(): AIProvider {
    // Check for provider configuration in environment
    const providerEnv = process.env.NEXT_PUBLIC_AI_PROVIDER?.toLowerCase();
    
    if (providerEnv === 'gemini' || providerEnv === 'claude') {
      return providerEnv as AIProvider;
    }

    // Check which API key is available
    const hasGeminiKey = !!process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const hasClaudeKey = !!process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;

    if (hasGeminiKey) {
      return 'gemini';
    } else if (hasClaudeKey) {
      return 'claude';
    }

    // Default to Gemini (more cost-effective)
    return 'gemini';
  }

  static reset(): void {
    this.instance = null;
    this.currentProvider = null;
  }

  static getCurrentProvider(): AIProvider | null {
    return this.currentProvider;
  }
}

/**
 * Get AI service instance
 */
export const getAIService = (provider?: AIProvider): IAIService => {
  return AIServiceFactory.getService(provider);
};

/**
 * Reset AI service (useful for testing or switching providers)
 */
export const resetAIService = (): void => {
  AIServiceFactory.reset();
};

/**
 * Get current AI provider
 */
export const getCurrentAIProvider = (): AIProvider | null => {
  return AIServiceFactory.getCurrentProvider();
};


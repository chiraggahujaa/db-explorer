import { BaseService } from './BaseService.js';
import { ApiResponse } from '../types/common.js';
import { supabaseAdmin } from '../utils/database.js';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface SummarizeOptions {
  maxMessagesToKeep: number; // Number of recent messages to keep unsummarized
  style?: 'brief' | 'detailed'; // Summary style
}

/**
 * Service for summarizing old chat messages to manage context window
 */
export class ChatSummarizationService extends BaseService {
  constructor() {
    super('chat_messages');
  }

  /**
   * Get messages for a chat session ordered by creation time
   */
  private async getMessages(chatSessionId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabaseAdmin
      .from(this.tableName)
      .select('id, role, content, created_at')
      .eq('chat_session_id', chatSessionId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return (data || []).map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      createdAt: msg.created_at,
    }));
  }

  /**
   * Generate a simple summary of old messages
   * This is a fallback method that doesn't require AI API calls
   */
  private generateSimpleSummary(messages: ChatMessage[]): string {
    if (messages.length === 0) {
      return '';
    }

    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    // Extract key topics from user messages (first 50 chars of each)
    const topics = userMessages
      .slice(0, 5) // First 5 user messages
      .map(m => m.content.slice(0, 50).trim())
      .filter(Boolean);

    // Count SQL-like patterns in assistant messages
    const sqlPatternCount = assistantMessages.filter(m =>
      /SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP/i.test(m.content)
    ).length;

    const parts: string[] = [];

    if (topics.length > 0) {
      parts.push(`Previously discussed: ${topics.join(', ')}...`);
    }

    if (sqlPatternCount > 0) {
      parts.push(`Executed ${sqlPatternCount} database operations`);
    }

    parts.push(`[${messages.length} messages summarized]`);

    return parts.join('. ');
  }

  /**
   * Generate AI-powered summary using Gemini (cost-effective option)
   * Falls back to simple summary if API call fails
   */
  private async generateAISummary(messages: ChatMessage[]): Promise<string> {
    try {
      // Check for Gemini API key
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('[ChatSummarizationService] No GEMINI_API_KEY found, using simple summary');
        return this.generateSimpleSummary(messages);
      }

      // Prepare conversation for summarization
      const conversationText = messages
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

      const prompt = `Summarize the following database conversation in 2-3 concise sentences. Focus on:
1. What database operations were discussed
2. Key tables or data mentioned
3. Main questions asked and answers provided

Conversation:
${conversationText}

Summary:`;

      // Call Gemini API
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }],
            }],
            generationConfig: {
              maxOutputTokens: 150,
              temperature: 0.3,
            },
          }),
        }
      );

      if (!response.ok) {
        console.warn('[ChatSummarizationService] Gemini API call failed, using simple summary');
        return this.generateSimpleSummary(messages);
      }

      const result = await response.json() as any;
      const summary = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!summary) {
        console.warn('[ChatSummarizationService] No summary from Gemini, using simple summary');
        return this.generateSimpleSummary(messages);
      }

      return `${summary.trim()} [${messages.length} messages summarized]`;
    } catch (error) {
      console.error('[ChatSummarizationService] Error generating AI summary:', error);
      return this.generateSimpleSummary(messages);
    }
  }

  /**
   * Get summarized context for a chat session
   * Returns recent messages + summary of older messages
   */
  async getSummarizedContext(
    chatSessionId: string,
    options: SummarizeOptions = { maxMessagesToKeep: 10 }
  ): Promise<ApiResponse<{
    recentMessages: ChatMessage[];
    summary: string | null;
    totalMessages: number;
  }>> {
    try {
      const allMessages = await this.getMessages(chatSessionId);

      // If total messages is less than or equal to max, no summarization needed
      if (allMessages.length <= options.maxMessagesToKeep) {
        return {
          success: true,
          data: {
            recentMessages: allMessages,
            summary: null,
            totalMessages: allMessages.length,
          },
        };
      }

      // Split messages into old (to summarize) and recent (to keep)
      const recentMessages = allMessages.slice(-options.maxMessagesToKeep);
      const oldMessages = allMessages.slice(0, -options.maxMessagesToKeep);

      // Generate summary of old messages
      const summary = options.style === 'detailed'
        ? await this.generateAISummary(oldMessages)
        : this.generateSimpleSummary(oldMessages);

      return {
        success: true,
        data: {
          recentMessages,
          summary,
          totalMessages: allMessages.length,
        },
      };
    } catch (error) {
      console.error('Error in ChatSummarizationService getSummarizedContext:', error);
      throw error;
    }
  }

  /**
   * Store a summary for future use (caching)
   */
  async storeSummary(
    chatSessionId: string,
    summary: string,
    messageCount: number
  ): Promise<ApiResponse<any>> {
    try {
      const { error } = await supabaseAdmin
        .from('chat_summaries')
        .upsert({
          chat_session_id: chatSessionId,
          summary,
          message_count: messageCount,
          created_at: new Date().toISOString(),
        })
        .eq('chat_session_id', chatSessionId);

      if (error) {
        // Table might not exist, that's okay
        console.warn('[ChatSummarizationService] Could not store summary:', error.message);
      }

      return {
        success: true,
        message: 'Summary stored successfully',
      };
    } catch (error) {
      console.error('Error in ChatSummarizationService storeSummary:', error);
      // Don't throw - this is optional functionality
      return {
        success: false,
        error: 'Failed to store summary',
      };
    }
  }
}

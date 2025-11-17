import { GoogleGenerativeAI } from '@google/generative-ai';
import { ApiResponse } from '../types/common.js';

export class TitleGenerationService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    } else {
      console.warn('GEMINI_API_KEY not found. Title generation will be unavailable.');
    }
  }

  /**
   * Generate a concise title from the first user message
   */
  async generateTitle(userMessage: string): Promise<ApiResponse<string>> {
    try {
      console.log('[TitleGenerationService] Starting title generation');

      if (!this.model) {
        console.error('[TitleGenerationService] Gemini API not configured');
        return {
          success: false,
          error: 'Gemini API not configured',
        };
      }

      // Truncate very long messages to avoid token limits
      const truncatedMessage = userMessage.length > 500
        ? userMessage.substring(0, 500) + '...'
        : userMessage;

      console.log('[TitleGenerationService] Message length:', userMessage.length, 'Truncated:', truncatedMessage.length);

      const prompt = `Generate a concise 3-5 word title for this database query or question. The title should capture the main intent or action. Return ONLY the title, nothing else.

User query: ${truncatedMessage}

Title:`;

      console.log('[TitleGenerationService] Calling Gemini API...');
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const title = response.text().trim();

      console.log('[TitleGenerationService] Raw title from Gemini:', title);

      // Clean up the title (remove quotes if present)
      const cleanTitle = title.replace(/^["']|["']$/g, '').trim();

      // Validate title length (max 255 chars for database)
      const finalTitle = cleanTitle.length > 255
        ? cleanTitle.substring(0, 252) + '...'
        : cleanTitle;

      console.log('[TitleGenerationService] Final title:', finalTitle);

      return {
        success: true,
        data: finalTitle,
      };
    } catch (error: any) {
      console.error('[TitleGenerationService] Error generating title:', error);

      // Fallback: create a simple title from the message
      const fallbackTitle = this.createFallbackTitle(userMessage);

      console.log('[TitleGenerationService] Using fallback title:', fallbackTitle);

      return {
        success: true,
        data: fallbackTitle,
        message: 'Used fallback title generation',
      };
    }
  }

  /**
   * Create a fallback title when Gemini is unavailable
   */
  private createFallbackTitle(message: string): string {
    // Take first 50 chars and add ellipsis if needed
    const maxLength = 50;
    let title = message.trim();

    if (title.length > maxLength) {
      title = title.substring(0, maxLength).trim() + '...';
    }

    return title || 'New Chat';
  }

  /**
   * Batch generate titles for multiple messages
   */
  async batchGenerateTitles(messages: string[]): Promise<ApiResponse<string[]>> {
    try {
      const titles = await Promise.all(
        messages.map(msg => this.generateTitle(msg))
      );

      const successfulTitles = titles
        .filter(result => result.success)
        .map(result => result.data as string);

      if (successfulTitles.length === 0) {
        return {
          success: false,
          error: 'Failed to generate any titles',
        };
      }

      return {
        success: true,
        data: successfulTitles,
      };
    } catch (error) {
      console.error('Error in batch title generation:', error);
      return {
        success: false,
        error: 'Batch title generation failed',
      };
    }
  }

  /**
   * Check if Gemini is configured and available
   */
  isAvailable(): boolean {
    return this.model !== null;
  }
}

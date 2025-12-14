import { Request, Response } from 'express';
import { ChatSessionService } from '../services/ChatSessionService.js';
import { ChatMessageService } from '../services/ChatMessageService.js';
import { TitleGenerationService } from '../services/TitleGenerationService.js';
import { ContextSummaryService } from '../services/ContextSummaryService.js';
import { ChatSummarizationService } from '../services/ChatSummarizationService.js';
import {
  createChatSessionSchema,
  updateChatSessionSchema,
  addMessageSchema,
  uuidSchema,
} from '../validations/chatSession.js';

export class ChatSessionController {
  private chatSessionService: ChatSessionService;
  private chatMessageService: ChatMessageService;
  private titleGenerationService: TitleGenerationService;
  private contextSummaryService: ContextSummaryService;
  private chatSummarizationService: ChatSummarizationService;

  constructor() {
    this.chatSessionService = new ChatSessionService();
    this.chatMessageService = new ChatMessageService();
    this.titleGenerationService = new TitleGenerationService();
    this.contextSummaryService = new ContextSummaryService();
    this.chatSummarizationService = new ChatSummarizationService();
  }

  /**
   * Get all chat sessions for the current user
   * GET /api/chat-sessions
   */
  async getMyChatSessions(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await this.chatSessionService.findByUserId(userId, { page, limit });

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Get my chat sessions error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get a single chat session with messages
   * GET /api/chat-sessions/:id
   */
  async getChatSession(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { id } = req.params;
      uuidSchema.parse(id);

      const result = await this.chatSessionService.findByIdWithMessages(id as string, userId as string);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Get chat session error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid chat session ID',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Create a new chat session
   * POST /api/chat-sessions
   */
  async createChatSession(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const validatedData = createChatSessionSchema.parse(req.body);

      // Filter out undefined values to satisfy exactOptionalPropertyTypes
      const sessionData: {
        userId: string;
        connectionId: string;
        title?: string;
        selectedSchema?: string;
        selectedTables?: string[];
        aiProvider?: 'gemini' | 'openai' | 'anthropic';
      } = {
        userId,
        connectionId: validatedData.connectionId,
        ...(validatedData.title !== undefined && { title: validatedData.title }),
        ...(validatedData.selectedSchema !== undefined && { selectedSchema: validatedData.selectedSchema }),
        ...(validatedData.selectedTables !== undefined && { selectedTables: validatedData.selectedTables }),
        ...(validatedData.aiProvider !== undefined && { aiProvider: validatedData.aiProvider }),
      };

      const result = await this.chatSessionService.createSession(sessionData);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(201).json(result);
    } catch (error: any) {
      console.error('Create chat session error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Update a chat session
   * PATCH /api/chat-sessions/:id
   */
  async updateChatSession(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { id } = req.params;
      uuidSchema.parse(id);

      const validatedData = updateChatSessionSchema.parse(req.body);

      // Filter out undefined values to satisfy exactOptionalPropertyTypes
      const updateData: {
        title?: string;
        selectedSchema?: string;
        selectedTables?: string[];
        connectionId?: string;
        aiProvider?: string;
      } = {
        ...(validatedData.title !== undefined && { title: validatedData.title }),
        ...(validatedData.selectedSchema !== undefined && { selectedSchema: validatedData.selectedSchema }),
        ...(validatedData.selectedTables !== undefined && { selectedTables: validatedData.selectedTables }),
        ...(validatedData.connectionId !== undefined && { connectionId: validatedData.connectionId }),
        ...(validatedData.aiProvider !== undefined && { aiProvider: validatedData.aiProvider }),
      };

      const result = await this.chatSessionService.updateSession(id as string, userId as string, updateData);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Update chat session error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Delete a chat session
   * DELETE /api/chat-sessions/:id
   */
  async deleteChatSession(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { id } = req.params;
      uuidSchema.parse(id);

      const result = await this.chatSessionService.deleteSession(id as string, userId as string);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Delete chat session error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid chat session ID',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Add a message to a chat session
   * POST /api/chat-sessions/:id/messages
   */
  async addMessage(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { id } = req.params;
      uuidSchema.parse(id);

      // Verify the chat session belongs to the user
      const sessionCheck = await this.chatSessionService.findByIdWithMessages(id as string, userId as string);
      if (!sessionCheck.success) {
        return res.status(404).json({
          success: false,
          error: 'Chat session not found',
        });
      }

      const validatedData = addMessageSchema.parse(req.body);

      const result = await this.chatMessageService.addMessage({
        chatSessionId: id as string,
        role: validatedData.role,
        content: validatedData.content,
        ...(validatedData.toolCalls !== undefined && { toolCalls: validatedData.toolCalls }),
        ...(validatedData.status !== undefined && { status: validatedData.status }),
        ...(validatedData.errorMessage !== undefined && { errorMessage: validatedData.errorMessage }),
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(201).json(result);
    } catch (error: any) {
      console.error('Add message error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get context summary for a chat session
   * GET /api/chat-sessions/:id/context
   */
  async getContext(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { id } = req.params;
      uuidSchema.parse(id);

      // Verify the chat session belongs to the user
      const sessionCheck = await this.chatSessionService.findByIdWithMessages(id as string, userId as string);
      if (!sessionCheck.success) {
        return res.status(404).json({
          success: false,
          error: 'Chat session not found',
        });
      }

      const result = await this.contextSummaryService.generateContextSummary(id as string);

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Get context error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid chat session ID',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Generate title for a chat session
   * POST /api/chat-sessions/:id/generate-title
   */
  async generateTitle(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { id } = req.params;
      uuidSchema.parse(id);

      console.log('[ChatSessionController] Generating title for chat session:', id);

      // Verify the chat session belongs to the user
      const sessionCheck = await this.chatSessionService.findByIdWithMessages(id as string, userId as string);
      if (!sessionCheck.success) {
        console.error('[ChatSessionController] Chat session not found:', id);
        return res.status(404).json({
          success: false,
          error: 'Chat session not found',
        });
      }

      // Get the first user message
      const firstMessageResult = await this.chatMessageService.getFirstUserMessage(id as string);
      if (!firstMessageResult.success || !firstMessageResult.data) {
        console.warn('[ChatSessionController] No user messages found for session:', id);
        return res.status(400).json({
          success: false,
          error: 'No user messages found in this chat session',
        });
      }

      console.log('[ChatSessionController] First user message:', firstMessageResult.data.content.substring(0, 100));

      // Generate title
      const titleResult = await this.titleGenerationService.generateTitle(
        firstMessageResult.data.content
      );

      if (!titleResult.success) {
        console.error('[ChatSessionController] Title generation failed:', titleResult.error);
        return res.status(500).json(titleResult);
      }

      console.log('[ChatSessionController] Generated title:', titleResult.data);

      // Update the chat session with the generated title
      const updateResult = await this.chatSessionService.updateSession(id as string, userId as string, {
        title: titleResult.data || '',
      });

      console.log('[ChatSessionController] Title updated in database');

      res.status(200).json({
        success: true,
        data: {
          title: titleResult.data,
        },
        message: 'Title generated successfully',
      });
    } catch (error: any) {
      console.error('[ChatSessionController] Generate title error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid chat session ID',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get chat sessions by connection ID
   * GET /api/connections/:connectionId/chat-sessions
   */
  async getChatSessionsByConnection(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { connectionId } = req.params;
      uuidSchema.parse(connectionId);

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await this.chatSessionService.findByConnectionId(
        connectionId as string,
        userId as string,
        { page, limit }
      );

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Get chat sessions by connection error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid connection ID',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get summarized context for a chat session
   * GET /api/chat-sessions/:id/summarize
   */
  async getSummarizedContext(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const { id } = req.params;
      uuidSchema.parse(id);

      // Verify the chat session belongs to the user
      const sessionCheck = await this.chatSessionService.findByIdWithMessages(id as string, userId as string);
      if (!sessionCheck.success) {
        return res.status(404).json({
          success: false,
          error: 'Chat session not found',
        });
      }

      // Get options from query params
      const maxMessagesToKeep = parseInt(req.query.maxMessages as string) || 10;
      const style = (req.query.style as 'brief' | 'detailed') || 'brief';

      const result = await this.chatSummarizationService.getSummarizedContext(id as string, {
        maxMessagesToKeep,
        style,
      });

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Get summarized context error:', error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid chat session ID',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}

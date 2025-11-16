/**
 * Claude AI Service
 * Integrates Anthropic's Claude with MCP tools for natural language database queries
 */

import Anthropic from '@anthropic-ai/sdk';
import { getMCPService } from './MCPService';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeStreamEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'error' | 'done';
  content?: string;
  toolName?: string;
  toolInput?: any;
  toolResult?: any;
  toolCallId?: string; // Unique ID for this tool call
  thinking?: string;
  error?: string;
}

export type ClaudeStreamCallback = (event: ClaudeStreamEvent) => void;

export interface ClaudeServiceOptions {
  apiKey: string;
  model?: string;
}

export class ClaudeService {
  private client: Anthropic;
  private model: string;
  private connectionId: string | null = null;
  private selectedDatabase: string | null = null;
  private conversationHistory: Anthropic.MessageParam[] = [];

  constructor(options: ClaudeServiceOptions) {
    this.client = new Anthropic({
      apiKey: options.apiKey,
      dangerouslyAllowBrowser: true, // Required for browser usage
    });
    this.model = options.model || 'claude-sonnet-4-20250514';
  }

  /**
   * Send a message to Claude with MCP tools available
   */
  async sendMessage(
    userMessage: string,
    connectionId: string,
    onStream?: ClaudeStreamCallback
  ): Promise<void> {
    try {
      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage,
      });

      // Get MCP tools to provide to Claude
      const mcpService = getMCPService();
      const mcpTools = await mcpService.listTools();

      // Convert MCP tools to Anthropic tool format
      const anthropicTools = this.convertMCPToolsToAnthropicFormat(mcpTools);

      console.log('[ClaudeService] Sending message with tools:', {
        message: userMessage,
        toolCount: anthropicTools.length,
      });

      // Create streaming message
      const stream = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: this.conversationHistory,
        tools: anthropicTools,
        stream: true,
      });

      let fullResponse = '';
      const toolUses: Array<{ id: string; name: string; input: any }> = [];
      const toolInputBuffers: Map<number, string> = new Map(); // Map content block index -> JSON buffer
      const contentBlockToToolIndex: Map<number, number> = new Map(); // Map content block index -> tool index

      // Process stream
      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          const content = event.content_block;
          
          if (content.type === 'text') {
            onStream?.({ type: 'text', content: '' });
          } else if (content.type === 'tool_use') {
            onStream?.({
              type: 'tool_use',
              toolName: content.name,
              toolInput: content.input,
              toolCallId: content.id,
            });

            // Store tool use placeholder - input will be accumulated from deltas
            const toolIndex = toolUses.length;
            toolUses.push({
              id: content.id,
              name: content.name,
              input: {}, // Start with empty input
            });
            
            // Map this content block index to our tool index
            contentBlockToToolIndex.set(event.index, toolIndex);
            toolInputBuffers.set(event.index, ''); // Initialize buffer with content block index
          }
        } else if (event.type === 'content_block_delta') {
          const delta = event.delta;
          
          if (delta.type === 'text_delta') {
            fullResponse += delta.text;
            onStream?.({ type: 'text', content: delta.text });
          } else if (delta.type === 'input_json_delta') {
            // Accumulate tool input JSON using content block index
            const currentBuffer = toolInputBuffers.get(event.index) || '';
            toolInputBuffers.set(event.index, currentBuffer + delta.partial_json);
          }
        } else if (event.type === 'content_block_stop') {
          // Parse accumulated tool input when block stops
          const toolIndex = contentBlockToToolIndex.get(event.index);
          const buffer = toolInputBuffers.get(event.index);
          
          if (toolIndex !== undefined && buffer && toolUses[toolIndex]) {
            try {
              toolUses[toolIndex].input = JSON.parse(buffer);
            } catch (e) {
              console.error('[ClaudeService] Failed to parse tool input:', buffer, e);
            }
          }
        } else if (event.type === 'message_delta') {
          if (event.delta.stop_reason === 'tool_use') {
            // Claude wants to use tools - execute them
            await this.executeToolsAndContinue(
              toolUses,
              onStream
            );
            return; // Will continue conversation after tool execution
          }
        } else if (event.type === 'message_stop') {
          // Add assistant response to history
          if (fullResponse) {
            this.conversationHistory.push({
              role: 'assistant',
              content: fullResponse,
            });
          }
          
          onStream?.({ type: 'done' });
        }
      }
    } catch (error: any) {
      console.error('[ClaudeService] Error:', error);
      onStream?.({
        type: 'error',
        error: error.message || 'Failed to communicate with Claude',
      });
      throw error;
    }
  }

  /**
   * Execute tools that Claude requested and continue the conversation
   */
  private async executeToolsAndContinue(
    toolUses: Array<{ id: string; name: string; input: any }>,
    onStream?: ClaudeStreamCallback,
    signal?: AbortSignal
  ): Promise<void> {
    const mcpService = getMCPService();
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    // Execute each tool
    for (const toolUse of toolUses) {
      // Check abort before each tool execution
      if (signal?.aborted) {
        console.log('[ClaudeService] Request aborted during tool execution');
        return;
      }

      try {
        console.log('[ClaudeService] Executing tool:', toolUse.name, 'Original input:', toolUse.input);

        onStream?.({
          type: 'tool_use',
          toolName: toolUse.name,
          toolInput: toolUse.input,
          toolCallId: toolUse.id,
        });

        // Execute via MCP - inject connection ID automatically
        if (!this.connectionId) {
          throw new Error('No connection ID set for MCP operations');
        }

        const injectedInput = this.injectConnectionId(toolUse.input, this.connectionId);
        console.log('[ClaudeService] Injected connection:', this.connectionId, 'Final input:', injectedInput);

        const result = await mcpService.executeQuery({
          tool: toolUse.name,
          arguments: injectedInput,
        });

        // Check abort after async operation
        if (signal?.aborted) {
          console.log('[ClaudeService] Request aborted after tool execution');
          return;
        }

        // Extract text content from MCP result
        let resultText = '';
        if (result.content && Array.isArray(result.content)) {
          resultText = result.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('\n');
        } else {
          resultText = JSON.stringify(result, null, 2);
        }

        console.log('[ClaudeService] Tool result:', resultText.substring(0, 200));

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: resultText,
        });

        onStream?.({
          type: 'tool_result',
          toolName: toolUse.name,
          toolResult: resultText,
          toolCallId: toolUse.id,
        });
      } catch (error: any) {
        console.error('[ClaudeService] Tool execution failed:', error);

        // Report error to Claude
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `Error executing tool: ${error.message}`,
          is_error: true,
        });

        onStream?.({
          type: 'error',
          error: `Tool ${toolUse.name} failed: ${error.message}`,
        });
      }
    }

    // Check abort before continuing conversation
    if (signal?.aborted) {
      console.log('[ClaudeService] Request aborted before continuing conversation');
      return;
    }

    // Add assistant's tool use to history
    this.conversationHistory.push({
      role: 'assistant',
      content: toolUses.map(tu => ({
        type: 'tool_use' as const,
        id: tu.id,
        name: tu.name,
        input: tu.input,
      })),
    });

    // Add tool results as user message
    this.conversationHistory.push({
      role: 'user',
      content: toolResults,
    });

    // Continue conversation with tool results
    await this.continueConversation(onStream, signal);
  }

  /**
   * Continue conversation after tool execution
   */
  private async continueConversation(
    onStream?: ClaudeStreamCallback,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      // Check abort before continuing
      if (signal?.aborted) {
        console.log('[ClaudeService] Request aborted in continueConversation');
        return;
      }

      const stream = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: this.conversationHistory,
        stream: true,
      });

      // Check abort after async operation
      if (signal?.aborted) {
        console.log('[ClaudeService] Request aborted after creating stream');
        return;
      }

      let fullResponse = '';

      for await (const event of stream) {
        // Check abort in streaming loop
        if (signal?.aborted) {
          console.log('[ClaudeService] Request aborted during continue streaming');
          return;
        }

        if (event.type === 'content_block_delta') {
          const delta = event.delta;

          if (delta.type === 'text_delta') {
            fullResponse += delta.text;
            onStream?.({ type: 'text', content: delta.text });
          }
        } else if (event.type === 'message_stop') {
          if (fullResponse) {
            this.conversationHistory.push({
              role: 'assistant',
              content: fullResponse,
            });
          }

          onStream?.({ type: 'done' });
        }
      }
    } catch (error: any) {
      // Don't throw error if aborted
      if (signal?.aborted) {
        console.log('[ClaudeService] Request aborted in continueConversation');
        return;
      }

      console.error('[ClaudeService] Error continuing conversation:', error);
      onStream?.({
        type: 'error',
        error: error.message,
      });
    }
  }

  /**
   * Convert MCP tools to Anthropic tool format
   */
  private convertMCPToolsToAnthropicFormat(mcpTools: any[]): Anthropic.Tool[] {
    return mcpTools.map((tool) => ({
      name: tool.name,
      description: tool.description || `Execute ${tool.name}`,
      input_schema: tool.inputSchema || {
        type: 'object',
        properties: {},
      },
    }));
  }

  /**
   * Inject connection ID and database into tool arguments if not already present
   */
  private injectConnectionId(toolInput: any, connectionId: string): any {
    const result: any = { ...toolInput };
    
    // Inject connection parameter if not present
    if (!result.connection && !result.databaseId) {
      result.connection = connectionId;
    }
    
    // Inject database parameter if we have a selected database and it's not already specified
    if (this.selectedDatabase && !result.database) {
      result.database = this.selectedDatabase;
    }

    return result;
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get conversation history
   */
  getHistory(): Anthropic.MessageParam[] {
    return [...this.conversationHistory];
  }

  /**
   * Set system prompt for context
   */
  async sendMessageWithSystem(
    userMessage: string,
    systemPrompt: string,
    connectionId: string,
    selectedDatabase: string | null,
    onStream?: ClaudeStreamCallback,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      // Check if already aborted
      if (signal?.aborted) {
        console.log('[ClaudeService] Request aborted before starting');
        return;
      }

      // Store connection ID and selected database for this conversation
      this.connectionId = connectionId;
      this.selectedDatabase = selectedDatabase;

      this.conversationHistory.push({
        role: 'user',
        content: userMessage,
      });

      const mcpService = getMCPService();
      const mcpTools = await mcpService.listTools();

      // Check abort after async operation
      if (signal?.aborted) {
        console.log('[ClaudeService] Request aborted after listing tools');
        return;
      }

      const anthropicTools = this.convertMCPToolsToAnthropicFormat(mcpTools);

      const stream = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: this.conversationHistory,
        tools: anthropicTools,
        stream: true,
      });

      // Check abort after async operation
      if (signal?.aborted) {
        console.log('[ClaudeService] Request aborted after creating stream');
        return;
      }

      let fullResponse = '';
      const toolUses: Array<{ id: string; name: string; input: any }> = [];
      const toolInputBuffers: Map<number, string> = new Map();
      const contentBlockToToolIndex: Map<number, number> = new Map();

      for await (const event of stream) {
        // Check abort in streaming loop
        if (signal?.aborted) {
          console.log('[ClaudeService] Request aborted during streaming');
          return;
        }

        if (event.type === 'content_block_start') {
          const content = event.content_block;

          if (content.type === 'tool_use') {
            const toolIndex = toolUses.length;
            toolUses.push({
              id: content.id,
              name: content.name,
              input: {},
            });
            contentBlockToToolIndex.set(event.index, toolIndex);
            toolInputBuffers.set(event.index, '');
          }
        } else if (event.type === 'content_block_delta') {
          const delta = event.delta;

          if (delta.type === 'text_delta') {
            fullResponse += delta.text;
            onStream?.({ type: 'text', content: delta.text });
          } else if (delta.type === 'input_json_delta') {
            const currentBuffer = toolInputBuffers.get(event.index) || '';
            toolInputBuffers.set(event.index, currentBuffer + delta.partial_json);
          }
        } else if (event.type === 'content_block_stop') {
          const toolIndex = contentBlockToToolIndex.get(event.index);
          const buffer = toolInputBuffers.get(event.index);

          if (toolIndex !== undefined && buffer && toolUses[toolIndex]) {
            try {
              toolUses[toolIndex].input = JSON.parse(buffer);
            } catch (e) {
              console.error('[ClaudeService] Failed to parse tool input:', buffer, e);
            }
          }
        } else if (event.type === 'message_delta') {
          if (event.delta.stop_reason === 'tool_use') {
            // Check abort before tool execution
            if (signal?.aborted) {
              console.log('[ClaudeService] Request aborted before tool execution');
              return;
            }
            await this.executeToolsAndContinue(toolUses, onStream, signal);
            return;
          }
        } else if (event.type === 'message_stop') {
          if (fullResponse) {
            this.conversationHistory.push({
              role: 'assistant',
              content: fullResponse,
            });
          }

          onStream?.({ type: 'done' });
        }
      }
    } catch (error: any) {
      // Don't throw error if aborted
      if (signal?.aborted) {
        console.log('[ClaudeService] Request aborted');
        return;
      }

      console.error('[ClaudeService] Error:', error);
      onStream?.({
        type: 'error',
        error: error.message,
      });
      throw error;
    }
  }
}

// Singleton instance
let claudeServiceInstance: ClaudeService | null = null;

export const getClaudeService = (apiKey?: string): ClaudeService => {
  if (!claudeServiceInstance) {
    const key = apiKey || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('Anthropic API key is required. Set NEXT_PUBLIC_ANTHROPIC_API_KEY environment variable.');
    }
    claudeServiceInstance = new ClaudeService({ apiKey: key });
  }
  return claudeServiceInstance;
};

export const resetClaudeService = (): void => {
  claudeServiceInstance = null;
};




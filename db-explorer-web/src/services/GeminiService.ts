/**
 * Gemini AI Service
 * Integrates Google's Gemini with MCP tools for natural language database queries
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { getMCPService } from './MCPService';

export interface GeminiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GeminiStreamEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'error' | 'done';
  content?: string;
  toolName?: string;
  toolInput?: any;
  toolResult?: any;
  toolCallId?: string; // Unique ID for this tool call
  thinking?: string;
  error?: string;
}

export type GeminiStreamCallback = (event: GeminiStreamEvent) => void;

export interface GeminiServiceOptions {
  apiKey: string;
  model?: string;
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: string;
  private connectionId: string | null = null;
  private selectedDatabase: string | null = null;
  private conversationHistory: Array<{ role: string; parts: any[] }> = [];

  constructor(options: GeminiServiceOptions) {
    this.genAI = new GoogleGenerativeAI(options.apiKey);
    // Use Gemini 2.5 Flash for cost-effectiveness (10x cheaper than Claude)
    this.model = options.model || 'gemini-2.5-flash';
  }

  /**
   * Send a message to Gemini with MCP tools available
   */
  async sendMessage(
    userMessage: string,
    connectionId: string,
    onStream?: GeminiStreamCallback
  ): Promise<void> {
    try {
      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        parts: [{ text: userMessage }],
      });

      // Get MCP tools to provide to Gemini
      const mcpService = getMCPService();
      const mcpTools = await mcpService.listTools();

      // Convert MCP tools to Gemini function declaration format
      const geminiTools = this.convertMCPToolsToGeminiFormat(mcpTools);

      console.log('[GeminiService] Sending message with tools:', {
        message: userMessage,
        toolCount: geminiTools.length,
      });

      // Create generative model with tools
      const model = this.genAI.getGenerativeModel({
        model: this.model,
        tools: geminiTools.length > 0 ? [{ functionDeclarations: geminiTools }] : undefined,
      });

      // Start a chat session with history
      const chat = model.startChat({
        history: this.conversationHistory.slice(0, -1), // Exclude the last message we just added
      });

      // Send message with streaming
      const result = await chat.sendMessageStream(userMessage);

      let fullResponse = '';
      const toolCalls: Array<{ id: string; name: string; args: any }> = [];

      // Process stream
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        
        if (chunkText) {
          fullResponse += chunkText;
          onStream?.({ type: 'text', content: chunkText });
        }

        // Check for function calls
        const functionCalls = chunk.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
          console.log('[GeminiService] 🎯 Gemini API returned function calls:', functionCalls);
          for (const fc of functionCalls) {
            console.log('[GeminiService] 📞 Function call from stream:', {
              name: fc.name,
              args: fc.args,
              argsType: typeof fc.args,
              argsKeys: fc.args ? Object.keys(fc.args) : 'null/undefined'
            });
            
            const toolCallId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            toolCalls.push({
              id: toolCallId,
              name: fc.name,
              args: fc.args,
            });

            onStream?.({
              type: 'tool_use',
              toolName: fc.name,
              toolInput: fc.args,
              toolCallId,
            });
          }
        }
      }

      // If tools were called, execute them and continue
      if (toolCalls.length > 0) {
        await this.executeToolsAndContinue(
          chat,
          toolCalls,
          onStream
        );
      } else {
        // Add assistant response to history
        if (fullResponse) {
          this.conversationHistory.push({
            role: 'model',
            parts: [{ text: fullResponse }],
          });
        }
        
        onStream?.({ type: 'done' });
      }
    } catch (error: any) {
      console.error('[GeminiService] Error:', error);
      onStream?.({
        type: 'error',
        error: error.message || 'Failed to communicate with Gemini',
      });
      throw error;
    }
  }

  /**
   * Execute tools that Gemini requested and continue the conversation
   */
  private async executeToolsAndContinue(
    chat: any,
    toolCalls: Array<{ id: string; name: string; args: any }>,
    onStream?: GeminiStreamCallback
  ): Promise<void> {
    const mcpService = getMCPService();
    const functionResponses: any[] = [];

    // Execute each tool
    for (const toolCall of toolCalls) {
      try {
        console.log('[GeminiService] 🔧 Tool Call:', toolCall.name);
        console.log('[GeminiService] 📥 Raw args from Gemini:', toolCall.args);
        console.log('[GeminiService] 📊 Args breakdown:', {
          table: toolCall.args?.table,
          tableName: toolCall.args?.tableName,
          table_name: toolCall.args?.table_name,
          allKeys: Object.keys(toolCall.args || {}),
        });

        // Execute via MCP - inject connection ID automatically
        if (!this.connectionId) {
          throw new Error('No connection ID set for MCP operations');
        }

        const injectedInput = this.injectConnectionId(toolCall.args, this.connectionId);
        console.log('[GeminiService] ✅ Final args to MCP:', injectedInput);

        const result = await mcpService.executeQuery({
          tool: toolCall.name,
          arguments: injectedInput,
        });

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

        console.log('[GeminiService] Tool result:', resultText.substring(0, 200));

        functionResponses.push({
          name: toolCall.name,
          response: {
            content: resultText,
          },
        });

        onStream?.({
          type: 'tool_result',
          toolName: toolCall.name,
          toolResult: resultText,
          toolCallId: toolCall.id,
        });
      } catch (error: any) {
        console.error('[GeminiService] Tool execution failed:', error);

        // Report error to Gemini
        functionResponses.push({
          name: toolCall.name,
          response: {
            content: `Error executing tool: ${error.message}`,
            error: true,
          },
        });

        onStream?.({
          type: 'error',
          error: `Tool ${toolCall.name} failed: ${error.message}`,
        });
      }
    }

    // Add function calls to history
    this.conversationHistory.push({
      role: 'model',
      parts: toolCalls.map(tc => ({
        functionCall: {
          name: tc.name,
          args: tc.args,
        },
      })),
    });

    // Add function responses to history
    this.conversationHistory.push({
      role: 'function',
      parts: functionResponses.map(fr => ({
        functionResponse: fr,
      })),
    });

    // Continue conversation with tool results
    await this.continueConversation(chat, functionResponses, onStream);
  }

  /**
   * Continue conversation after tool execution
   */
  private async continueConversation(
    chat: any,
    functionResponses: any[],
    onStream?: GeminiStreamCallback
  ): Promise<void> {
    try {
      // Send all function responses back to Gemini
      const responseParts = functionResponses.map(fr => ({
        functionResponse: {
          name: fr.name,
          response: fr.response,
        },
      }));

      const result = await chat.sendMessageStream(responseParts);

      let fullResponse = '';
      const newToolCalls: Array<{ id: string; name: string; args: any }> = [];

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();

        if (chunkText) {
          fullResponse += chunkText;
          onStream?.({ type: 'text', content: chunkText });
        }

        // Check if Gemini wants to call more tools
        const functionCalls = chunk.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
          for (const fc of functionCalls) {
            const toolCallId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            newToolCalls.push({
              id: toolCallId,
              name: fc.name,
              args: fc.args,
            });

            onStream?.({
              type: 'tool_use',
              toolName: fc.name,
              toolInput: fc.args,
              toolCallId,
            });
          }
        }
      }

      // If more tools were called, execute them
      if (newToolCalls.length > 0) {
        await this.executeToolsAndContinue(chat, newToolCalls, onStream);
        return;
      }

      if (fullResponse) {
        this.conversationHistory.push({
          role: 'model',
          parts: [{ text: fullResponse }],
        });
      }
      
      onStream?.({ type: 'done' });
    } catch (error: any) {
      console.error('[GeminiService] Error continuing conversation:', error);
      onStream?.({
        type: 'error',
        error: error.message,
      });
    }
  }

  /**
   * Convert MCP tools to Gemini function declaration format
   */
  private convertMCPToolsToGeminiFormat(mcpTools: any[]): any[] {
    return mcpTools.map((tool) => {
      const schema = tool.inputSchema || { type: 'object', properties: {} };
      
      // Convert JSON Schema to Gemini format
      const parameters = this.convertJsonSchemaToGemini(schema);

      return {
        name: tool.name,
        description: tool.description || `Execute ${tool.name}`,
        parameters,
      };
    });
  }

  /**
   * Convert JSON Schema to Gemini parameter format
   */
  private convertJsonSchemaToGemini(schema: any): any {
    const result: any = {
      type: SchemaType.OBJECT,
      properties: {},
    };

    // Only add required array if it has items
    if (schema.required && schema.required.length > 0) {
      result.required = schema.required;
    }

    if (schema.properties) {
      for (const [key, value] of Object.entries(schema.properties)) {
        const prop: any = value;
        const propertyDef: any = {
          type: this.mapJsonSchemaTypeToGemini(prop.type),
          description: prop.description || prop.describe || '',
        };

        // Handle nested objects
        if (prop.type === 'object' && prop.properties) {
          propertyDef.properties = this.convertJsonSchemaToGemini(prop).properties;
          if (prop.required) {
            propertyDef.required = prop.required;
          }
        }

        // Handle arrays
        if (prop.type === 'array' && prop.items) {
          propertyDef.items = {
            type: this.mapJsonSchemaTypeToGemini(prop.items.type),
          };
          if (prop.items.properties) {
            propertyDef.items.properties = this.convertJsonSchemaToGemini(prop.items).properties;
          }
        }

        result.properties[key] = propertyDef;
      }
    }

    return result;
  }

  /**
   * Map JSON Schema types to Gemini types
   */
  private mapJsonSchemaTypeToGemini(type: string): SchemaType {
    switch (type) {
      case 'string':
        return SchemaType.STRING;
      case 'number':
        return SchemaType.NUMBER;
      case 'integer':
        return SchemaType.INTEGER;
      case 'boolean':
        return SchemaType.BOOLEAN;
      case 'array':
        return SchemaType.ARRAY;
      case 'object':
        return SchemaType.OBJECT;
      default:
        return SchemaType.STRING;
    }
  }

  /**
   * Normalize parameter names from Gemini's snake_case to MCP's camelCase
   */
  private normalizeParameterNames(args: any): any {
    if (!args || typeof args !== 'object') {
      return args;
    }

    const normalized: any = {};
    
    // Common snake_case to camelCase mappings and Gemini naming variations
    const mappings: Record<string, string> = {
      // Snake case to camelCase
      'table_name': 'table',
      'order_by': 'orderBy',
      'left_table': 'leftTable',
      'right_table': 'rightTable',
      'join_type': 'joinType',
      'join_condition': 'joinCondition',
      'search_term': 'searchTerm',
      'timestamp_column': 'timestampColumn',
      'time_range': 'timeRange',
      'parent_table': 'parentTable',
      'parent_column': 'parentColumn',
      'child_table': 'childTable',
      'child_column': 'childColumn',
      'foreign_key': 'foreignKey',
      'source_table': 'sourceTable',
      'target_table': 'targetTable',
      'batch_size': 'batchSize',
      // Gemini uses 'query' but execute_custom_query expects 'sql'
      'query': 'sql',
    };

    for (const [key, value] of Object.entries(args)) {
      const normalizedKey = mappings[key] || key;
      normalized[normalizedKey] = value;
    }

    return normalized;
  }

  /**
   * Inject connection ID and database into tool arguments if not already present
   */
  private injectConnectionId(toolInput: any, connectionId: string): any {
    // Handle null or undefined input
    if (!toolInput || typeof toolInput !== 'object') {
      console.warn('[GeminiService] Invalid toolInput received:', toolInput);
      toolInput = {};
    }

    // First normalize parameter names (snake_case -> camelCase)
    let result: any = this.normalizeParameterNames(toolInput);
    
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
  getHistory(): Array<{ role: string; parts: any[] }> {
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
    onStream?: GeminiStreamCallback
  ): Promise<void> {
    try {
      // Store connection ID and selected database for this conversation
      this.connectionId = connectionId;
      this.selectedDatabase = selectedDatabase;
      
      // Get MCP tools to provide to Gemini
      const mcpService = getMCPService();
      const mcpTools = await mcpService.listTools();

      // Convert MCP tools to Gemini function declaration format
      const geminiTools = this.convertMCPToolsToGeminiFormat(mcpTools);

      console.log('[GeminiService] Sending message with system prompt and tools:', {
        message: userMessage,
        toolCount: geminiTools.length,
      });

      // Create generative model with system instruction and tools
      const model = this.genAI.getGenerativeModel({
        model: this.model,
        systemInstruction: systemPrompt,
        tools: geminiTools.length > 0 ? [{ functionDeclarations: geminiTools }] : undefined,
      });

      // Start a chat session with history
      const chat = model.startChat({
        history: this.conversationHistory,
      });

      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        parts: [{ text: userMessage }],
      });

      // Send message with streaming
      const result = await chat.sendMessageStream(userMessage);

      let fullResponse = '';
      const toolCalls: Array<{ id: string; name: string; args: any }> = [];

      // Process stream
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        
        if (chunkText) {
          fullResponse += chunkText;
          onStream?.({ type: 'text', content: chunkText });
        }

        // Check for function calls
        const functionCalls = chunk.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
          console.log('[GeminiService] 🎯 Gemini API returned function calls:', functionCalls);
          for (const fc of functionCalls) {
            console.log('[GeminiService] 📞 Function call from stream:', {
              name: fc.name,
              args: fc.args,
              argsType: typeof fc.args,
              argsKeys: fc.args ? Object.keys(fc.args) : 'null/undefined'
            });
            
            const toolCallId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            toolCalls.push({
              id: toolCallId,
              name: fc.name,
              args: fc.args,
            });

            onStream?.({
              type: 'tool_use',
              toolName: fc.name,
              toolInput: fc.args,
              toolCallId,
            });
          }
        }
      }

      // If tools were called, execute them and continue
      if (toolCalls.length > 0) {
        await this.executeToolsAndContinue(
          chat,
          toolCalls,
          onStream
        );
      } else {
        // Add assistant response to history
        if (fullResponse) {
          this.conversationHistory.push({
            role: 'model',
            parts: [{ text: fullResponse }],
          });
        }
        
        onStream?.({ type: 'done' });
      }
    } catch (error: any) {
      console.error('[GeminiService] Error:', error);
      onStream?.({
        type: 'error',
        error: error.message,
      });
      throw error;
    }
  }
}

// Singleton instance
let geminiServiceInstance: GeminiService | null = null;

export const getGeminiService = (apiKey?: string): GeminiService => {
  if (!geminiServiceInstance) {
    const key = apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!key) {
      throw new Error('Gemini API key is required. Set NEXT_PUBLIC_GEMINI_API_KEY environment variable.');
    }
    geminiServiceInstance = new GeminiService({ apiKey: key });
  }
  return geminiServiceInstance;
};

export const resetGeminiService = (): void => {
  geminiServiceInstance = null;
};


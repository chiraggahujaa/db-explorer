'use client';

/**
 * ToolCallItem Component
 * Displays a single tool call with collapsible SQL query and result
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { ToolCallData } from '@/utils/sqlExtractor';
import { ResultDisplay } from './ResultDisplay';

interface ToolCallItemProps {
  toolCall: ToolCallData;
  className?: string;
}

export function ToolCallItem({ toolCall, className = '' }: ToolCallItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);

  const handleCopySQL = () => {
    if (toolCall.sqlQuery) {
      navigator.clipboard.writeText(toolCall.sqlQuery);
      toast.success('Copied to clipboard', {
        description: 'SQL query copied successfully',
      });
    }
  };

  // Format tool name for display
  const formatToolName = (name: string) => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className={`border rounded-md bg-card ${className}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 flex-1 justify-start p-0 h-auto font-normal"
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <Database className="h-4 w-4 text-blue-500" />
              <span className="font-medium">{formatToolName(toolCall.name)}</span>
            </Button>
          </CollapsibleTrigger>

          {toolCall.sqlQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleCopySQL();
              }}
              className="h-8 w-8 p-0"
            >
              <Copy className="h-4 w-4" />
              <span className="sr-only">Copy SQL</span>
            </Button>
          )}
        </div>

        <CollapsibleContent>
          <div className="border-t px-3 pb-3 space-y-3">
            {/* SQL Query Display */}
            {toolCall.sqlQuery && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    SQL Query
                  </span>
                </div>
                <div className="rounded-md overflow-hidden border">
                  <SyntaxHighlighter
                    language="sql"
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      padding: '12px',
                      fontSize: '13px',
                      lineHeight: '1.5',
                    }}
                    wrapLongLines
                  >
                    {toolCall.sqlQuery}
                  </SyntaxHighlighter>
                </div>
              </div>
            )}

            {/* Tool Input Arguments (if no SQL available) */}
            {!toolCall.sqlQuery && toolCall.input && Object.keys(toolCall.input).length > 0 && (
              <div className="mt-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                  Arguments
                </span>
                <div className="bg-muted/50 rounded-md p-3">
                  <pre className="text-xs font-mono overflow-auto">
                    {JSON.stringify(toolCall.input, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Result - Collapsible */}
            {toolCall.result && (
              <div className="mt-3">
                <Collapsible open={isResultOpen} onOpenChange={setIsResultOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-2 p-0 h-auto font-normal mb-2 hover:bg-transparent"
                    >
                      {isResultOpen ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Result
                      </span>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ResultDisplay result={toolCall.result} />
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

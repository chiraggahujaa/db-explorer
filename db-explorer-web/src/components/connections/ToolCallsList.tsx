'use client';

/**
 * ToolCallsList Component
 * Displays a list of tool calls with their execution details
 */

import React from 'react';
import type { ToolCallData } from '@/utils/sqlExtractor';
import { ToolCallItem } from './ToolCallItem';

interface ToolCallsListProps {
  toolCalls: ToolCallData[];
  className?: string;
}

export function ToolCallsList({ toolCalls, className = '' }: ToolCallsListProps) {
  if (!toolCalls || toolCalls.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Tool Calls ({toolCalls.length})
      </div>
      {toolCalls.map((toolCall) => (
        <ToolCallItem key={toolCall.id} toolCall={toolCall} />
      ))}
    </div>
  );
}

'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/ui';
import { ExportableTable } from './ExportableTable';

interface MessageMarkdownProps {
  content: string;
  className?: string;
  isIncognitoMode?: boolean;
  onSQLExecutionRequest?: (sql: string) => void;
}

function CodeBlock({
  code,
  language,
  isIncognitoMode,
  onSQLExecutionRequest
}: {
  code: string;
  language: string;
  isIncognitoMode?: boolean;
  onSQLExecutionRequest?: (sql: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isSQLBlock = language === 'sql' && isIncognitoMode;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const handleExecute = () => {
    if (onSQLExecutionRequest) {
      onSQLExecutionRequest(code);
    }
  };

  return (
    <div className="relative group">
      <div className="absolute right-2 top-2 z-10 flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-8 px-2 bg-background/80 backdrop-blur hover:bg-background"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              <span className="text-xs">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              <span className="text-xs">Copy</span>
            </>
          )}
        </Button>

        {isSQLBlock && onSQLExecutionRequest && (
          <Button
            variant="default"
            size="sm"
            onClick={handleExecute}
            className="h-8 px-2 bg-purple-500 hover:bg-purple-600 text-white"
          >
            <span className="text-xs">Execute</span>
          </Button>
        )}
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
          padding: '1rem',
        }}
        PreTag="div"
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export function MessageMarkdown({ content, className, isIncognitoMode, onSQLExecutionRequest }: MessageMarkdownProps) {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // Customize paragraph styling
        p: ({ node, children, ...props }) => (
          <p className="text-sm leading-relaxed mb-2 last:mb-0" {...props}>
            {children}
          </p>
        ),
        // Customize strong (bold) styling
        strong: ({ node, children, ...props }) => (
          <strong className="font-semibold text-primary" {...props}>
            {children}
          </strong>
        ),
        // Customize list styling
        ul: ({ node, children, ...props }) => (
          <ul className="space-y-1 my-2" {...props}>
            {children}
          </ul>
        ),
        li: ({ node, children, ...props }) => (
          <li className="text-sm leading-relaxed ml-4" {...props}>
            {children}
          </li>
        ),
        // Customize code blocks with syntax highlighting
        code: ({ node, inline, className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';
          const codeString = String(children).replace(/\n$/, '');

          if (inline) {
            return (
              <code
                className="bg-muted/70 dark:bg-muted/50 px-1.5 py-0.5 rounded text-xs font-mono text-primary"
                {...props}
              >
                {children}
              </code>
            );
          }

          // Use syntax highlighter for code blocks, especially SQL
          if (language) {
            return (
              <CodeBlock
                code={codeString}
                language={language}
                isIncognitoMode={isIncognitoMode}
                onSQLExecutionRequest={onSQLExecutionRequest}
              />
            );
          }

          return (
            <code
              className={cn(
                'font-mono text-xs',
                className
              )}
              {...props}
            >
              {children}
            </code>
          );
        },
        // Customize pre blocks
        pre: ({ node, children, ...props }) => {
          const { ref, ...divProps } = props as any;
          return (
            <div className="relative my-2" {...divProps}>
              {children}
            </div>
          );
        },
        // Customize headings
        h1: ({ node, children, ...props }) => (
          <h1 className="text-lg font-bold mb-2 mt-4 first:mt-0" {...props}>
            {children}
          </h1>
        ),
        h2: ({ node, children, ...props }) => (
          <h2 className="text-base font-bold mb-2 mt-3 first:mt-0" {...props}>
            {children}
          </h2>
        ),
        h3: ({ node, children, ...props }) => (
          <h3 className="text-sm font-bold mb-1.5 mt-2 first:mt-0" {...props}>
            {children}
          </h3>
        ),
        // Customize blockquotes
        blockquote: ({ node, children, ...props }) => (
          <blockquote
            className="border-l-4 border-primary/30 pl-4 py-1 my-2 italic text-muted-foreground"
            {...props}
          >
            {children}
          </blockquote>
        ),
        // Customize tables with export functionality
        table: ({ node, children, ...props }) => {
          return (
            <ExportableTable>
              <table className="min-w-full divide-y divide-border" {...props}>
                {children}
              </table>
            </ExportableTable>
          );
        },
        thead: ({ node, children, ...props }) => (
          <thead className="bg-muted" {...props}>
            {children}
          </thead>
        ),
        tbody: ({ node, children, ...props }) => (
          <tbody className="divide-y divide-border" {...props}>
            {children}
          </tbody>
        ),
        tr: ({ node, children, ...props }) => (
          <tr {...props}>{children}</tr>
        ),
        th: ({ node, children, ...props }) => (
          <th className="px-3 py-2 text-left text-xs font-semibold" {...props}>
            {children}
          </th>
        ),
        td: ({ node, children, ...props }) => (
          <td className="px-3 py-2 text-xs font-mono" {...props}>
            {children}
          </td>
        ),
        // Customize links
        a: ({ node, children, ...props }) => (
          <a
            className="text-primary hover:text-primary/80 underline font-medium"
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          >
            {children}
          </a>
        ),
        // Customize horizontal rules
        hr: ({ node, ...props }) => (
          <hr className="my-4 border-border" {...props} />
        ),
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/utils/ui';

interface MessageMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Custom Markdown renderer for chat messages
 * Renders markdown with improved formatting for database results
 */
export function MessageMarkdown({ content, className }: MessageMarkdownProps) {
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
        // Customize code blocks
        code: ({ node, inline, className, children, ...props }: any) => {
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
        pre: ({ node, children, ...props }) => (
          <pre className="bg-muted/50 dark:bg-muted/30 p-3 rounded-md overflow-x-auto my-2" {...props}>
            {children}
          </pre>
        ),
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
        // Customize tables
        table: ({ node, children, ...props }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full divide-y divide-border" {...props}>
              {children}
            </table>
          </div>
        ),
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

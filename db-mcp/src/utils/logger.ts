/**
 * Logger Utility
 * Provides structured logging with different log levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
}

class Logger {
  private minLevel: LogLevel;
  private context?: string;

  constructor(context?: string, minLevel: LogLevel = 'info') {
    this.context = context;
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private formatMessage(level: LogLevel, message: string, context?: Record<string, any>): string {
    const timestamp = new Date().toISOString();
    const prefix = this.context ? `[${this.context}]` : '';
    const levelEmoji = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
    }[level];

    let logMessage = `${levelEmoji} ${timestamp} ${prefix} [${level.toUpperCase()}] ${message}`;
    
    if (context && Object.keys(context).length > 0) {
      logMessage += ` ${JSON.stringify(context)}`;
    }

    return logMessage;
  }

  debug(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  info(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('info')) {
      console.error(this.formatMessage('info', message, context)); // Using console.error for stderr
    }
  }

  warn(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('warn')) {
      console.error(this.formatMessage('warn', message, context));
    }
  }

  error(message: string, error?: Error | any, context?: Record<string, any>): void {
    if (this.shouldLog('error')) {
      const errorContext = {
        ...context,
        ...(error instanceof Error
          ? {
              error: error.message,
              stack: error.stack,
              ...(error as any).code && { code: (error as any).code },
              ...(error as any).errno && { errno: (error as any).errno },
            }
          : error
          ? { error: String(error) }
          : {}),
      };
      console.error(this.formatMessage('error', message, errorContext));
    }
  }

  success(message: string, context?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    const prefix = this.context ? `[${this.context}]` : '';
    console.error(`✅ ${timestamp} ${prefix} ${message}`, context || '');
  }

  child(context: string): Logger {
    const childContext = this.context ? `${this.context}:${context}` : context;
    return new Logger(childContext, this.minLevel);
  }
}

// Create default logger instance
const defaultLogger = new Logger(
  undefined,
  (process.env.LOG_LEVEL as LogLevel) || 'info'
);

export { Logger, defaultLogger as logger };
export type { LogLevel };










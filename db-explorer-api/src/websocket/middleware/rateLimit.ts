/**
 * WebSocket Rate Limiting Middleware
 * Implements per-user and per-connection rate limiting
 */

import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import type { AuthenticatedSocket } from './auth.js';

interface RateLimitConfig {
  maxMessages: number;
  windowMs: number;
  maxTypingEvents: number;
  typingWindowMs: number;
}

interface RateLimitStore {
  [key: string]: {
    messages: number[];
    typingEvents: number[];
  };
}

const defaultConfig: RateLimitConfig = {
  maxMessages: 30, // 30 messages per minute
  windowMs: 60 * 1000, // 1 minute
  maxTypingEvents: 10, // 10 typing events per minute
  typingWindowMs: 60 * 1000, // 1 minute
};

class RateLimiter {
  private store: RateLimitStore = {};
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  private cleanup() {
    const now = Date.now();
    Object.keys(this.store).forEach((key) => {
      const userStore = this.store[key];
      if (!userStore) return;
      
      // Clean old message timestamps
      userStore.messages = userStore.messages.filter(
        (timestamp) => now - timestamp < this.config.windowMs
      );
      
      // Clean old typing event timestamps
      userStore.typingEvents = userStore.typingEvents.filter(
        (timestamp) => now - timestamp < this.config.typingWindowMs
      );
      
      // Remove empty entries
      if (userStore.messages.length === 0 && userStore.typingEvents.length === 0) {
        delete this.store[key];
      }
    });
  }

  checkMessage(userId: string): { allowed: boolean; remaining: number; resetAt: number } {
    this.cleanup();
    
    if (!this.store[userId]) {
      this.store[userId] = { messages: [], typingEvents: [] };
    }

    const userStore = this.store[userId]!;
    const now = Date.now();
    
    // Remove old timestamps
    userStore.messages = userStore.messages.filter(
      (timestamp) => now - timestamp < this.config.windowMs
    );

    const remaining = Math.max(0, this.config.maxMessages - userStore.messages.length);
    const allowed = remaining > 0;
    const resetAt = now + this.config.windowMs;

    if (allowed) {
      userStore.messages.push(now);
    }

    return { allowed, remaining, resetAt };
  }

  checkTyping(userId: string): { allowed: boolean; remaining: number; resetAt: number } {
    this.cleanup();
    
    if (!this.store[userId]) {
      this.store[userId] = { messages: [], typingEvents: [] };
    }

    const userStore = this.store[userId]!;
    const now = Date.now();
    
    // Remove old timestamps
    userStore.typingEvents = userStore.typingEvents.filter(
      (timestamp) => now - timestamp < this.config.typingWindowMs
    );

    const remaining = Math.max(0, this.config.maxTypingEvents - userStore.typingEvents.length);
    const allowed = remaining > 0;
    const resetAt = now + this.config.typingWindowMs;

    if (allowed) {
      userStore.typingEvents.push(now);
    }

    return { allowed, remaining, resetAt };
  }

  reset(userId: string) {
    delete this.store[userId];
  }
}

const rateLimiter = new RateLimiter();

/**
 * Rate limit middleware for chat messages
 */
export const rateLimitMessages = (
  socket: AuthenticatedSocket,
  next: (err?: ExtendedError) => void
) => {
  const userId = socket.data.user.userId;
  const check = rateLimiter.checkMessage(userId);

  if (!check.allowed) {
    const error = new Error('Rate limit exceeded') as ExtendedError;
    error.data = {
      type: 'RATE_LIMIT',
      remaining: check.remaining,
      resetAt: check.resetAt,
    };
    return next(error);
  }

  next();
};

/**
 * Rate limit middleware for typing events
 */
export const rateLimitTyping = (
  socket: AuthenticatedSocket,
  next: (err?: ExtendedError) => void
) => {
  const userId = socket.data.user.userId;
  const check = rateLimiter.checkTyping(userId);

  if (!check.allowed) {
    const error = new Error('Typing rate limit exceeded') as ExtendedError;
    error.data = {
      type: 'RATE_LIMIT',
      remaining: check.remaining,
      resetAt: check.resetAt,
    };
    return next(error);
  }

  next();
};

/**
 * Reset rate limits for a user (useful for testing or manual reset)
 */
export const resetRateLimit = (userId: string) => {
  rateLimiter.reset(userId);
};


/**
 * Presence Service
 * Manages user presence status across connections
 */

import type { PresenceStatus } from '../types/socket.js';

export class PresenceService {
  private presence: Map<string, Map<string, PresenceStatus>> = new Map(); // userId -> connectionId -> status
  private lastActivity: Map<string, Map<string, number>> = new Map(); // userId -> connectionId -> timestamp

  /**
   * Update user presence for a specific connection
   */
  updatePresence(
    userId: string,
    connectionId: string,
    status: PresenceStatus['status']
  ): PresenceStatus {
    if (!this.presence.has(userId)) {
      this.presence.set(userId, new Map());
      this.lastActivity.set(userId, new Map());
    }

    const userPresence = this.presence.get(userId)!;
    const userActivity = this.lastActivity.get(userId)!;

    const presenceData: PresenceStatus = {
      userId,
      connectionId,
      status,
      ...(status === 'offline' && { lastSeen: Date.now() }),
    };

    userPresence.set(connectionId, presenceData);
    userActivity.set(connectionId, Date.now());

    return presenceData;
  }

  /**
   * Get presence status for a user and connection
   */
  getPresence(userId: string, connectionId: string): PresenceStatus | undefined {
    return this.presence.get(userId)?.get(connectionId);
  }

  /**
   * Get all presence statuses for a user
   */
  getUserPresences(userId: string): PresenceStatus[] {
    const userPresence = this.presence.get(userId);
    if (!userPresence) {
      return [];
    }
    return Array.from(userPresence.values());
  }

  /**
   * Remove presence when user disconnects
   */
  removePresence(userId: string, connectionId: string): void {
    const userPresence = this.presence.get(userId);
    if (userPresence) {
      userPresence.delete(connectionId);
      if (userPresence.size === 0) {
        this.presence.delete(userId);
      }
    }

    const userActivity = this.lastActivity.get(userId);
    if (userActivity) {
      userActivity.delete(connectionId);
      if (userActivity.size === 0) {
        this.lastActivity.delete(userId);
      }
    }
  }

  /**
   * Mark user as away if inactive for specified duration
   */
  markInactiveAsAway(inactiveThresholdMs: number = 5 * 60 * 1000): void {
    const now = Date.now();
    
    this.presence.forEach((userPresence, userId) => {
      const userActivity = this.lastActivity.get(userId);
      if (!userActivity) return;

      userPresence.forEach((presence, connectionId) => {
        if (presence.status === 'online') {
          const lastActivity = userActivity.get(connectionId);
          if (lastActivity && now - lastActivity > inactiveThresholdMs) {
            this.updatePresence(userId, connectionId, 'away');
          }
        }
      });
    });
  }

  /**
   * Get all online users for a connection
   */
  getOnlineUsers(connectionId: string): PresenceStatus[] {
    const result: PresenceStatus[] = [];
    
    this.presence.forEach((userPresence) => {
      const presence = userPresence.get(connectionId);
      if (presence && presence.status === 'online') {
        result.push(presence);
      }
    });

    return result;
  }

  /**
   * Clear all presence data (useful for testing)
   */
  clear(): void {
    this.presence.clear();
    this.lastActivity.clear();
  }
}


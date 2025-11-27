# Job Management & Notification System - Design Document

## Executive Summary

This document outlines the design and implementation of an enterprise-grade asynchronous job management and notification system for DB Explorer. The system handles long-running operations (like schema rebuilds) and keeps users informed about job progress through multiple notification channels.

## Industry Standards & Best Practices

### Job Queue System
- **Selected Technology**: `pg-boss` (PostgreSQL-based job queue)
- **Why pg-boss**:
  - ✅ No additional infrastructure (uses existing Supabase/PostgreSQL)
  - ✅ ACID transaction guarantees
  - ✅ Built-in retry mechanisms with exponential backoff
  - ✅ Job scheduling, delayed jobs, cron support
  - ✅ Job prioritization and rate limiting
  - ✅ Dead letter queue for failed jobs
  - ✅ Simpler than Redis-based solutions for current scale

### Real-time Communication
- **Selected Technology**: `Socket.IO`
- **Why Socket.IO**:
  - ✅ WebSocket with automatic fallback to polling
  - ✅ Room-based broadcasting (user-specific notifications)
  - ✅ Built-in reconnection logic
  - ✅ Strong TypeScript support
  - ✅ Battle-tested in production environments

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Job Status   │  │ Notification │  │ WebSocket    │          │
│  │ Component    │  │ Center       │  │ Client       │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTP / WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Job          │  │ Notification │  │ WebSocket    │          │
│  │ Controller   │  │ Controller   │  │ Server       │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Service Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ JobService   │  │ Notification │  │ Schema       │          │
│  │ (pg-boss)    │  │ Service      │  │ Training     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Worker Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Schema       │  │ Data Export  │  │ Bulk Import  │          │
│  │ Rebuild      │  │ Worker       │  │ Worker       │          │
│  │ Worker       │  │ (future)     │  │ (future)     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ pgboss.*     │  │ notifications│  │ connection_  │          │
│  │ (job queue)  │  │ (in-app)     │  │ schema_cache │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### 1. Job Tables (pg-boss managed)

pg-boss automatically creates its own schema and tables:
- `pgboss.job` - Active jobs
- `pgboss.archive` - Completed jobs (configurable retention)
- `pgboss.schedule` - Scheduled/recurring jobs
- `pgboss.version` - Schema version tracking

### 2. Notifications Table

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Notification details
  type VARCHAR(50) NOT NULL, -- 'job_queued', 'job_started', 'job_completed', 'job_failed', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,

  -- Optional data payload (job details, links, etc.)
  data JSONB DEFAULT '{}',

  -- Read status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Auto-delete old notifications

  -- Indexes for performance
  INDEX idx_notifications_user_id (user_id),
  INDEX idx_notifications_read (user_id, read, created_at DESC),
  INDEX idx_notifications_created_at (created_at)
);

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);
```

### 3. Notification Preferences Table

```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Preference settings
  notification_type VARCHAR(50) NOT NULL, -- 'job_status', 'invitations', 'system', etc.
  channel VARCHAR(20) NOT NULL, -- 'in_app', 'email', 'push'
  enabled BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one preference per user per type per channel
  UNIQUE(user_id, notification_type, channel)
);

-- Default preferences for new users
CREATE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id, notification_type, channel, enabled)
  VALUES
    (NEW.id, 'job_status', 'in_app', true),
    (NEW.id, 'job_status', 'email', true),
    (NEW.id, 'invitations', 'in_app', true),
    (NEW.id, 'invitations', 'email', true),
    (NEW.id, 'system', 'in_app', true),
    (NEW.id, 'system', 'email', false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_default_notification_preferences
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_preferences();
```

## Job Types & Workflows

### Job Type: Schema Rebuild

**Job Name**: `schema-rebuild`

**Payload**:
```typescript
{
  connectionId: string;
  userId: string;
  force?: boolean;
}
```

**Workflow**:
1. User triggers rebuild: `POST /api/connections/:id/rebuild`
2. System creates job in queue with status "queued"
3. System sends notification: "Schema rebuild queued"
4. Worker picks up job → status changes to "active"
5. System sends notification: "Schema rebuild started"
6. Worker executes `SchemaTrainingService.trainSchema()`
7. Worker updates progress: 0% → 25% → 50% → 75% → 100%
8. On success:
   - Job status → "completed"
   - Notification: "Schema rebuild completed successfully"
   - WebSocket emit: Job status update
9. On failure:
   - Job status → "failed"
   - Notification: "Schema rebuild failed: {error}"
   - Retry mechanism: 3 attempts with exponential backoff

**Progress Tracking**:
```typescript
interface JobProgress {
  current: number;    // Current step
  total: number;      // Total steps
  percentage: number; // 0-100
  message?: string;   // "Processing table: users"
}
```

### Future Job Types

- `data-export` - Export query results to CSV/JSON
- `bulk-import` - Import data from files
- `backup-connection` - Backup database schema
- `analytics-report` - Generate usage reports

## API Endpoints

### Job Management

```typescript
// Create a new job (generic endpoint)
POST /api/jobs
Body: {
  type: 'schema-rebuild' | 'data-export' | 'bulk-import',
  payload: Record<string, any>
}
Response: {
  id: string,
  type: string,
  status: 'queued',
  createdAt: string
}

// Get job by ID
GET /api/jobs/:id
Response: {
  id: string,
  type: string,
  status: 'queued' | 'active' | 'completed' | 'failed' | 'cancelled',
  progress?: JobProgress,
  result?: any,
  error?: string,
  createdAt: string,
  startedAt?: string,
  completedAt?: string
}

// List user's jobs (with pagination)
GET /api/jobs?page=1&limit=20&status=completed&type=schema-rebuild
Response: {
  data: Job[],
  pagination: { page, limit, total, totalPages }
}

// Cancel a job
DELETE /api/jobs/:id
Response: { message: 'Job cancelled' }

// Retry a failed job
POST /api/jobs/:id/retry
Response: { id: string, status: 'queued' }
```

### Schema Rebuild Endpoint

```typescript
// Trigger schema rebuild (creates job)
POST /api/connections/:id/rebuild
Body: { force?: boolean }
Response: {
  jobId: string,
  message: 'Schema rebuild job queued'
}
```

### Notification Management

```typescript
// Get user's notifications
GET /api/notifications?page=1&limit=20&unread=true
Response: {
  data: Notification[],
  pagination: { page, limit, total, totalPages },
  unreadCount: number
}

// Mark notification as read
PATCH /api/notifications/:id/read
Response: { id: string, read: true, readAt: string }

// Mark all as read
PATCH /api/notifications/read-all
Response: { count: number }

// Delete notification
DELETE /api/notifications/:id
Response: { message: 'Notification deleted' }

// Get notification preferences
GET /api/notifications/preferences
Response: NotificationPreference[]

// Update notification preference
PATCH /api/notifications/preferences/:id
Body: { enabled: boolean }
Response: NotificationPreference
```

## WebSocket Events

### Client → Server

```typescript
// Authenticate connection
socket.emit('authenticate', { token: 'jwt-token' });

// Subscribe to job updates
socket.emit('subscribe:job', { jobId: 'uuid' });

// Unsubscribe from job
socket.emit('unsubscribe:job', { jobId: 'uuid' });
```

### Server → Client

```typescript
// Authentication result
socket.on('authenticated', (data: { userId: string }) => {});

// New notification
socket.on('notification', (notification: Notification) => {});

// Job status update
socket.on('job:status', (data: {
  jobId: string,
  status: JobStatus,
  progress?: JobProgress
}) => {});

// Job completed
socket.on('job:completed', (data: {
  jobId: string,
  result: any
}) => {});

// Job failed
socket.on('job:failed', (data: {
  jobId: string,
  error: string
}) => {});
```

## Service Layer

### JobService

```typescript
class JobService {
  private boss: PgBoss;

  // Initialize pg-boss
  async initialize(): Promise<void>;

  // Create and queue a job
  async createJob(type: string, payload: any, options?: JobOptions): Promise<string>;

  // Get job status
  async getJob(jobId: string): Promise<Job | null>;

  // Get user's jobs
  async getUserJobs(userId: string, filters: JobFilters): Promise<PaginatedResult<Job>>;

  // Cancel job
  async cancelJob(jobId: string): Promise<void>;

  // Retry failed job
  async retryJob(jobId: string): Promise<string>;

  // Register job handler
  async work(jobName: string, handler: JobHandler): Promise<void>;

  // Update job progress
  async updateProgress(jobId: string, progress: JobProgress): Promise<void>;
}

interface JobOptions {
  priority?: number;      // 0-100, higher = more priority
  retryLimit?: number;    // Max retry attempts
  retryDelay?: number;    // Delay between retries (seconds)
  retryBackoff?: boolean; // Exponential backoff
  expireInSeconds?: number;
  singletonKey?: string;  // Prevent duplicate jobs
}
```

### NotificationService

```typescript
class NotificationService extends BaseService {
  // Create notification
  async createNotification(data: CreateNotificationData): Promise<Notification>;

  // Send notification (in-app + email based on preferences)
  async sendNotification(userId: string, notification: NotificationData): Promise<void>;

  // Get user notifications
  async getUserNotifications(userId: string, filters: NotificationFilters): Promise<PaginatedResult<Notification>>;

  // Mark as read
  async markAsRead(notificationId: string, userId: string): Promise<void>;

  // Mark all as read
  async markAllAsRead(userId: string): Promise<number>;

  // Delete notification
  async deleteNotification(notificationId: string, userId: string): Promise<void>;

  // Get unread count
  async getUnreadCount(userId: string): Promise<number>;

  // Get user preferences
  async getPreferences(userId: string): Promise<NotificationPreference[]>;

  // Update preference
  async updatePreference(preferenceId: string, enabled: boolean): Promise<void>;

  // Check if notification should be sent
  private async shouldSendNotification(userId: string, type: string, channel: string): Promise<boolean>;
}
```

### WebSocketService

```typescript
class WebSocketService {
  private io: Server;
  private userSockets: Map<string, Set<string>>; // userId → socketIds

  // Initialize Socket.IO
  initialize(server: http.Server): void;

  // Handle client connection
  private handleConnection(socket: Socket): void;

  // Authenticate socket
  private authenticateSocket(socket: Socket, token: string): Promise<User>;

  // Send notification to user
  sendToUser(userId: string, event: string, data: any): void;

  // Broadcast to all connected users
  broadcast(event: string, data: any): void;

  // Get connected users count
  getConnectedUsersCount(): number;
}
```

## Job Workers

### Schema Rebuild Worker

```typescript
// workers/schemaRebuildWorker.ts
export async function registerSchemaRebuildWorker(jobService: JobService) {
  await jobService.work('schema-rebuild', async (job) => {
    const { connectionId, userId, force } = job.data;

    try {
      // Step 1: Validate connection
      await jobService.updateProgress(job.id, {
        current: 1,
        total: 4,
        percentage: 25,
        message: 'Validating connection...'
      });

      // Send notification: Job started
      await notificationService.sendNotification(userId, {
        type: 'job_started',
        title: 'Schema Rebuild Started',
        message: `Schema rebuild for connection has started`,
        data: { jobId: job.id, connectionId }
      });

      // Step 2: Fetch schema
      await jobService.updateProgress(job.id, {
        current: 2,
        total: 4,
        percentage: 50,
        message: 'Fetching schema metadata...'
      });

      const schemaData = await schemaTrainingService.trainSchema(connectionId, force);

      // Step 3: Process and cache
      await jobService.updateProgress(job.id, {
        current: 3,
        total: 4,
        percentage: 75,
        message: 'Processing schema data...'
      });

      // Step 4: Complete
      await jobService.updateProgress(job.id, {
        current: 4,
        total: 4,
        percentage: 100,
        message: 'Schema rebuild completed'
      });

      // Send notification: Job completed
      await notificationService.sendNotification(userId, {
        type: 'job_completed',
        title: 'Schema Rebuild Completed',
        message: `Schema rebuild completed successfully with ${schemaData.total_tables} tables`,
        data: {
          jobId: job.id,
          connectionId,
          tablesCount: schemaData.total_tables
        }
      });

      return { success: true, schemaData };

    } catch (error) {
      // Send notification: Job failed
      await notificationService.sendNotification(userId, {
        type: 'job_failed',
        title: 'Schema Rebuild Failed',
        message: `Schema rebuild failed: ${error.message}`,
        data: { jobId: job.id, connectionId, error: error.message }
      });

      throw error;
    }
  }, {
    teamSize: 3,           // Process up to 3 jobs concurrently
    teamConcurrency: 1     // Each worker processes 1 job at a time
  });
}
```

## Error Handling & Retry Strategy

### Retry Configuration

```typescript
const JOB_RETRY_CONFIG = {
  'schema-rebuild': {
    retryLimit: 3,
    retryDelay: 60,        // 1 minute
    retryBackoff: true,    // Exponential: 1min, 2min, 4min
    expireInHours: 24
  },
  'data-export': {
    retryLimit: 2,
    retryDelay: 30,
    retryBackoff: true,
    expireInHours: 12
  }
};
```

### Error Categories

1. **Retryable Errors**:
   - Network timeouts
   - Database connection failures
   - Temporary service unavailability
   - Rate limiting

2. **Non-retryable Errors**:
   - Invalid credentials
   - Permission denied
   - Invalid job payload
   - Resource not found

### Dead Letter Queue

Failed jobs after max retries are moved to pg-boss archive for manual review.

```typescript
// Monitor failed jobs
async function monitorFailedJobs() {
  const failedJobs = await boss.fetch('schema-rebuild', 100, {
    includeMetadata: true
  });

  // Log to monitoring system
  // Alert administrators
  // Attempt manual recovery
}
```

## Security Considerations

### Authentication & Authorization

1. **Job Creation**: Only authenticated users can create jobs
2. **Job Access**: Users can only view/cancel their own jobs
3. **WebSocket Auth**: JWT validation on socket connection
4. **Notification Access**: Users can only see their own notifications

### Data Privacy

1. **Sensitive Data**: Never store passwords/keys in job payload
2. **Encryption**: Job results containing sensitive data should be encrypted
3. **Retention**: Auto-delete job history after 30 days
4. **Audit Logs**: Track who created/cancelled jobs

## Performance Optimizations

### Database

1. **Indexes**: Proper indexing on user_id, created_at, status
2. **Partitioning**: Partition notifications by created_at (monthly)
3. **Archival**: Move old jobs to archive table
4. **Connection Pooling**: Reuse database connections

### WebSocket

1. **Room-based Broadcasting**: Only notify relevant users
2. **Message Throttling**: Batch progress updates
3. **Compression**: Enable WebSocket compression
4. **Scaling**: Use Redis adapter for multi-server setup

### Job Queue

1. **Batch Processing**: Process multiple jobs in parallel
2. **Rate Limiting**: Prevent queue overload
3. **Priority Queues**: Critical jobs get priority
4. **Singleton Jobs**: Prevent duplicate concurrent jobs

## Monitoring & Observability

### Metrics to Track

```typescript
// Job metrics
- jobs_created_total (counter)
- jobs_completed_total (counter)
- jobs_failed_total (counter)
- job_duration_seconds (histogram)
- jobs_in_queue (gauge)

// Notification metrics
- notifications_sent_total (counter)
- notifications_read_rate (gauge)
- notification_delivery_duration (histogram)

// WebSocket metrics
- websocket_connections_total (gauge)
- websocket_messages_sent_total (counter)
- websocket_errors_total (counter)
```

### Health Checks

```typescript
GET /api/health/jobs
Response: {
  status: 'healthy' | 'degraded' | 'unhealthy',
  queueSize: number,
  activeJobs: number,
  failedJobs: number,
  lastProcessedAt: string
}

GET /api/health/websocket
Response: {
  status: 'healthy',
  connectedClients: number,
  uptime: number
}
```

## Deployment Considerations

### Environment Variables

```env
# pg-boss configuration
PGBOSS_SCHEMA=pgboss
PGBOSS_ARCHIVE_COMPLETED_AFTER_SECONDS=86400  # 24 hours
PGBOSS_DELETE_ARCHIVED_AFTER_DAYS=30

# WebSocket configuration
WEBSOCKET_PORT=5001
WEBSOCKET_CORS_ORIGIN=http://localhost:3000
WEBSOCKET_PING_INTERVAL=25000
WEBSOCKET_PING_TIMEOUT=60000

# Job configuration
MAX_CONCURRENT_JOBS=5
JOB_TIMEOUT_MINUTES=30

# Notification configuration
NOTIFICATION_RETENTION_DAYS=90
EMAIL_NOTIFICATIONS_ENABLED=true
```

### Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');

  // Stop accepting new jobs
  await jobService.stop();

  // Wait for active jobs to complete (with timeout)
  await jobService.waitForActiveJobs(30000);

  // Close WebSocket connections
  await webSocketService.close();

  // Close database connections
  await supabase.close();

  process.exit(0);
});
```

## Testing Strategy

### Unit Tests

- JobService methods
- NotificationService methods
- Worker handlers
- WebSocket event handlers

### Integration Tests

- Job lifecycle (create → execute → complete)
- Notification delivery (in-app + email)
- WebSocket connection and message delivery
- Retry mechanism

### E2E Tests

- User triggers rebuild → receives notifications → sees completion
- Job cancellation flow
- Multiple concurrent jobs
- Network failure recovery

## Migration Plan

### Phase 1: Foundation (Week 1)
- ✅ Install dependencies
- ✅ Create database migrations
- ✅ Implement JobService
- ✅ Implement NotificationService
- ✅ Create API endpoints

### Phase 2: Workers (Week 2)
- ✅ Implement schema rebuild worker
- ✅ Update existing schema training to use jobs
- ✅ Add retry logic
- ✅ Testing

### Phase 3: Real-time (Week 3)
- ✅ Implement WebSocket server
- ✅ Frontend integration
- ✅ Real-time notifications
- ✅ Testing

### Phase 4: Polish (Week 4)
- ✅ Error handling improvements
- ✅ Performance optimization
- ✅ Documentation
- ✅ Production deployment

## Future Enhancements

1. **Multi-tenancy**: Isolate jobs by organization
2. **Scheduled Jobs**: Cron-based recurring jobs
3. **Job Dependencies**: Chain jobs together
4. **Job Templates**: Predefined job configurations
5. **Advanced Analytics**: Job performance dashboards
6. **Webhooks**: External system notifications
7. **Push Notifications**: Mobile app support
8. **Job Marketplace**: Community-contributed job types

## References

- [pg-boss Documentation](https://github.com/timgit/pg-boss)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Queue Design Patterns](https://learn.microsoft.com/en-us/azure/architecture/patterns/queue-based-load-leveling)
- [PostgreSQL Job Queue Best Practices](https://www.2ndquadrant.com/en/blog/what-is-select-skip-locked-for-in-postgresql-9-5/)

# Job Management & Notification System - Setup Guide

## Overview

This document provides setup instructions for the newly implemented job management and notification system in DB Explorer. This system enables asynchronous processing of long-running operations (like schema rebuilds) and keeps users informed through multiple notification channels.

## Features

### Job Management System
- ✅ **Async Job Processing**: Long-running operations run in the background using pg-boss (PostgreSQL-based job queue)
- ✅ **Job Tracking**: Monitor job status, progress, and results
- ✅ **Retry Mechanism**: Automatic retry with exponential backoff for failed jobs
- ✅ **Priority Queuing**: Prioritize critical jobs
- ✅ **Singleton Jobs**: Prevent duplicate concurrent operations
- ✅ **Job Cancellation**: Cancel running jobs
- ✅ **Job Statistics**: View job metrics and history

### Notification System
- ✅ **Multi-Channel Delivery**: In-app notifications and email (push notifications ready for future implementation)
- ✅ **User Preferences**: Users can control which notifications they receive on which channels
- ✅ **Real-time Updates**: WebSocket integration for instant notifications
- ✅ **Notification Center**: View, mark as read, and manage notifications
- ✅ **Smart Notifications**: Context-aware notifications for job events, invitations, and system messages

### Real-time Communication
- ✅ **WebSocket Support**: Real-time job status updates via Socket.IO
- ✅ **User-specific Rooms**: Private channels for each user
- ✅ **Job Subscriptions**: Subscribe to specific job updates
- ✅ **Automatic Reconnection**: Resilient connection handling

## Architecture

```
┌─────────────────────────────────────────────────┐
│           Client (Web Application)              │
│  • Job Status Tracking                          │
│  • Notification Center                          │
│  • WebSocket Real-time Updates                  │
└─────────────────────────────────────────────────┘
                    ▲
                    │ HTTP / WebSocket
                    ▼
┌─────────────────────────────────────────────────┐
│              API Server (Express)               │
│  Routes:                                        │
│  • POST /api/connections/:id/rebuild            │
│  • GET /api/jobs                                │
│  • GET /api/jobs/:id                            │
│  • GET /api/notifications                       │
│  • PATCH /api/notifications/:id/read            │
└─────────────────────────────────────────────────┘
                    ▲
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│              Services Layer                     │
│  • JobService (pg-boss)                         │
│  • NotificationService                          │
│  • WebSocketService (Socket.IO)                 │
│  • EmailService (Resend)                        │
└─────────────────────────────────────────────────┘
                    ▲
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│              Workers                            │
│  • Schema Rebuild Worker                        │
│  • Future: Data Export, Bulk Import, etc.       │
└─────────────────────────────────────────────────┘
                    ▲
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│              Database (PostgreSQL)              │
│  • pgboss.* (job queue tables)                  │
│  • notifications                                │
│  • notification_preferences                     │
│  • connection_schema_cache                      │
└─────────────────────────────────────────────────┘
```

## Setup Instructions

### 1. Install Dependencies

Dependencies have already been installed during implementation:

```bash
cd db-explorer-api
npm install
```

**New Dependencies Added:**
- `pg-boss` - PostgreSQL-based job queue
- `socket.io` - WebSocket server for real-time communication

### 2. Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Database Connection (required for pg-boss)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_DB_PASSWORD=your-database-password
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# pg-boss Configuration (optional - defaults shown)
PGBOSS_SCHEMA=pgboss
PGBOSS_ARCHIVE_COMPLETED_AFTER_SECONDS=86400  # 24 hours
PGBOSS_DELETE_ARCHIVED_AFTER_DAYS=30
PGBOSS_RETENTION_DAYS=7

# WebSocket Configuration (optional - defaults shown)
WEBSOCKET_CORS_ORIGIN=http://localhost:3000
WEBSOCKET_PING_INTERVAL=25000  # 25 seconds
WEBSOCKET_PING_TIMEOUT=60000   # 60 seconds

# Job Configuration (optional - defaults shown)
MAX_CONCURRENT_JOBS=5
JOB_TIMEOUT_MINUTES=30

# Notification Configuration (optional - defaults shown)
NOTIFICATION_RETENTION_DAYS=90
EMAIL_NOTIFICATIONS_ENABLED=true

# Email Service (for email notifications)
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=noreply@dbexplorer.com
EMAIL_FROM_NAME=DB Explorer
```

### 3. Apply Database Migrations

#### Option A: Using Supabase CLI (Recommended)

```bash
cd db-explorer-api

# If Supabase CLI is not installed:
npm install -g supabase

# Link to your Supabase project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

#### Option B: Manual Migration

If you prefer to apply migrations manually, execute the SQL file directly:

```bash
# Connect to your Supabase database and run:
psql -h db.your-project.supabase.co \
     -U postgres \
     -d postgres \
     -f supabase/migrations/20251127000001_create_notifications_system.sql
```

#### Option C: Via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/20251127000001_create_notifications_system.sql`
4. Execute the SQL

### 4. Verify Migration

After applying the migration, verify that the following tables exist:

```sql
-- Check notifications table
SELECT * FROM notifications LIMIT 1;

-- Check notification_preferences table
SELECT * FROM notification_preferences LIMIT 1;

-- Check pg-boss tables (created automatically by pg-boss)
SELECT * FROM pgboss.job LIMIT 1;
```

### 5. Start the Server

```bash
npm run dev
```

You should see output like:

```
🔧 Initializing services...
📦 Initializing job queue...
✅ Job queue initialized
👷 Registering job workers...
Registering schema rebuild worker...
Schema rebuild worker registered successfully
✅ Job workers registered
🔌 Initializing WebSocket service...
✅ WebSocket service initialized
📅 Schema training scheduler started (cron: 0 2 * * 0)
✅ All services initialized successfully
🚀 DB Explorer API Server is running on port 5000
📊 Environment: development
🌐 Health check: http://localhost:5000/health
📖 API Base URL: http://localhost:5000/api
🔌 WebSocket URL: http://localhost:5000
```

## API Endpoints

### Job Management

```typescript
// Trigger schema rebuild (creates async job)
POST /api/connections/:id/rebuild
Body: { force?: boolean }
Response: {
  success: true,
  data: {
    jobId: "uuid",
    message: "Schema rebuild job queued successfully"
  }
}

// Get job status
GET /api/jobs/:id
Response: {
  success: true,
  data: {
    id: "uuid",
    name: "schema-rebuild",
    state: "completed",
    progress: { percentage: 100, message: "Completed" },
    result: { ... },
    createdOn: "2025-11-27T...",
    completedOn: "2025-11-27T..."
  }
}

// List user's jobs
GET /api/jobs?page=1&limit=20&status=completed&type=schema-rebuild
Response: {
  success: true,
  data: [ ... ],
  pagination: { page: 1, total: 10, ... }
}

// Cancel job
DELETE /api/jobs/:id

// Retry failed job
POST /api/jobs/:id/retry
```

### Notifications

```typescript
// Get user's notifications
GET /api/notifications?page=1&limit=20&read=false
Response: {
  success: true,
  data: [
    {
      id: "uuid",
      type: "job_completed",
      title: "Schema Rebuild Completed",
      message: "Schema rebuild completed successfully with 15 tables",
      read: false,
      createdAt: "2025-11-27T..."
    }
  ],
  unreadCount: 5,
  pagination: { ... }
}

// Mark notification as read
PATCH /api/notifications/:id/read

// Mark all as read
PATCH /api/notifications/read-all

// Delete notification
DELETE /api/notifications/:id

// Get unread count
GET /api/notifications/unread-count
Response: { success: true, data: { count: 5 } }

// Get notification preferences
GET /api/notifications/preferences
Response: {
  success: true,
  data: [
    {
      id: "uuid",
      notificationType: "job_status",
      channel: "in_app",
      enabled: true
    },
    {
      id: "uuid",
      notificationType: "job_status",
      channel: "email",
      enabled: true
    }
  ]
}

// Update notification preference
PATCH /api/notifications/preferences/:id
Body: { enabled: false }
```

## WebSocket Events

### Client → Server

```javascript
// Connect to WebSocket
const socket = io('http://localhost:5000', {
  transports: ['websocket', 'polling']
});

// Authenticate (required)
socket.emit('authenticate', {
  token: 'your-jwt-token'
});

// Subscribe to job updates
socket.emit('subscribe:job', {
  jobId: 'uuid'
});

// Subscribe to notifications (automatic after auth)
socket.emit('subscribe:notifications');
```

### Server → Client

```javascript
// Authentication success
socket.on('authenticated', (data) => {
  console.log('Authenticated:', data.userId);
});

// New notification received
socket.on('notification', (notification) => {
  console.log('New notification:', notification);
  // Show toast or update UI
});

// Job status update
socket.on('job:status', (data) => {
  console.log('Job update:', data.jobId, data.event, data.progress);
  // Update job progress UI
});

// Job completed
socket.on('job:update', (data) => {
  if (data.event === 'completed') {
    console.log('Job completed:', data.result);
  }
});
```

## Usage Examples

### Example 1: Trigger Schema Rebuild

```bash
# Create a schema rebuild job
curl -X POST http://localhost:5000/api/connections/{connection-id}/rebuild \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'

# Response
{
  "success": true,
  "data": {
    "jobId": "123e4567-e89b-12d3-a456-426614174000",
    "message": "Schema rebuild job queued successfully"
  }
}

# Check job status
curl http://localhost:5000/api/jobs/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer {token}"

# Response
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "schema-rebuild",
    "state": "active",
    "progress": {
      "current": 3,
      "total": 5,
      "percentage": 60,
      "message": "Fetching schema metadata..."
    }
  }
}
```

### Example 2: Monitor Notifications

```javascript
// Frontend code
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

// Authenticate
socket.emit('authenticate', { token: localStorage.getItem('token') });

// Listen for new notifications
socket.on('notification', (notification) => {
  // Show toast notification
  showToast(notification.title, notification.message);

  // Update notification count
  updateNotificationCount();
});

// Fetch notifications
async function fetchNotifications() {
  const response = await fetch('/api/notifications', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const { data, unreadCount } = await response.json();
  renderNotifications(data);
  updateBadge(unreadCount);
}
```

## Testing

### Test Job Creation

```bash
# 1. Create a database connection first
# 2. Trigger schema rebuild
curl -X POST http://localhost:5000/api/connections/{connection-id}/rebuild \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{}'

# 3. Watch server logs to see job processing
```

Expected log output:
```
[Job 123...] Starting schema rebuild for connection abc...
[Job 123...] Schema rebuild completed successfully in 2500ms
```

### Test Notifications

```bash
# 1. Trigger an operation that creates notifications (like schema rebuild)
# 2. Check notifications
curl http://localhost:5000/api/notifications \
  -H "Authorization: Bearer {token}"

# 3. Mark as read
curl -X PATCH http://localhost:5000/api/notifications/{notification-id}/read \
  -H "Authorization: Bearer {token}"
```

### Test WebSocket

```javascript
// Browser console
const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('Connected');
  socket.emit('authenticate', { token: 'your-token' });
});

socket.on('authenticated', (data) => {
  console.log('Authenticated:', data);
});

socket.on('notification', (notification) => {
  console.log('Notification:', notification);
});

socket.on('job:update', (data) => {
  console.log('Job update:', data);
});
```

## Troubleshooting

### pg-boss Connection Issues

**Error**: `Failed to initialize JobService: Database password not found`

**Solution**: Ensure `SUPABASE_DB_PASSWORD` or `DB_PASSWORD` is set in your `.env` file.

```bash
# Get your database password from Supabase:
# 1. Go to Supabase Dashboard > Settings > Database
# 2. Find the "Connection string" section
# 3. Copy the password
```

### WebSocket Connection Refused

**Error**: `WebSocket connection to 'ws://localhost:5000' failed`

**Solution**: Check CORS configuration

```bash
# In .env
WEBSOCKET_CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

### Migration Already Applied

**Error**: `relation "notifications" already exists`

**Solution**: The migration has already been applied. You can verify with:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('notifications', 'notification_preferences');
```

### Jobs Not Processing

**Issue**: Jobs stay in "created" state

**Debugging Steps**:
1. Check server logs for worker registration
2. Verify pg-boss schema exists: `SELECT * FROM pgboss.version;`
3. Check job queue: `SELECT * FROM pgboss.job WHERE state = 'created';`
4. Restart server to re-register workers

## Production Considerations

### 1. Database Connection Pool

pg-boss uses its own connection pool. For production, ensure your database can handle additional connections:

```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Adjust max connections if needed (in Supabase dashboard or postgresql.conf)
```

### 2. Job Retention

Configure job retention based on your needs:

```bash
# Keep completed jobs for 7 days before archiving
PGBOSS_ARCHIVE_COMPLETED_AFTER_SECONDS=604800

# Delete archived jobs after 30 days
PGBOSS_DELETE_ARCHIVED_AFTER_DAYS=30
```

### 3. Monitoring

Monitor job queue health:

```sql
-- Check job states
SELECT name, state, COUNT(*) as count
FROM pgboss.job
GROUP BY name, state;

-- Check failed jobs
SELECT name, data, output
FROM pgboss.job
WHERE state = 'failed'
ORDER BY createdon DESC
LIMIT 10;
```

### 4. Scaling

For horizontal scaling with multiple server instances:

1. **pg-boss**: Works out of the box (uses PostgreSQL for coordination)
2. **WebSocket**: Use Redis adapter for multi-server Socket.IO

```javascript
// Future: Add Redis adapter for Socket.IO
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));
```

## Next Steps

### Frontend Implementation

1. **Create Job Status Component**
   - Display job progress
   - Show job history
   - Cancel/retry actions

2. **Create Notification Center**
   - Notification dropdown
   - Mark as read/unread
   - Notification preferences

3. **Integrate WebSocket**
   - Real-time job updates
   - Toast notifications
   - Connection status indicator

### Additional Job Types

The system is designed to handle multiple job types. To add new job types:

1. Add type to `JobType` enum in `src/types/job.ts`
2. Create worker in `src/workers/`
3. Register worker in `src/workers/index.ts`
4. Add API endpoint if needed

Example: Data Export Worker

```typescript
// src/workers/dataExportWorker.ts
export async function registerDataExportWorker() {
  await jobService.work('data-export', async (job) => {
    const { connectionId, query, format } = job.data;

    // Execute query
    // Convert to format (CSV, JSON, Excel)
    // Upload to storage
    // Return download URL

    return { fileUrl, fileName, rowCount };
  });
}
```

## Support

For issues or questions:
- Check logs: `npm run dev` (watch for error messages)
- Review design document: `JOB_NOTIFICATION_SYSTEM_DESIGN.md`
- API documentation: See route files in `src/routes/`

## Summary

You now have a fully functional job management and notification system! Key features:

✅ Async job processing with pg-boss
✅ Real-time notifications via WebSocket
✅ Email notifications via Resend
✅ User notification preferences
✅ Job retry and cancellation
✅ Schema rebuild as async job

The system is production-ready and extensible for future job types.

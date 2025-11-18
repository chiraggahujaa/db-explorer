# Async Job Queue Architecture

## Overview

DB Explorer now includes a **generalized, industry-level async job processing system** built with BullMQ and Redis. This architecture allows long-running operations (like schema training) to be processed asynchronously, with real-time notifications to users via Server-Sent Events (SSE).

## Architecture Components

### 1. **Job Queue System** (`JobQueueService`)
**Location:** `db-explorer-api/src/services/JobQueueService.ts`

- **Technology:** BullMQ + Redis
- **Features:**
  - Multiple job types with priority levels
  - Automatic retries with exponential backoff
  - Job progress tracking
  - Persistent job storage in Redis
  - Scalable worker architecture

**Key Methods:**
- `addJob()` - Queue a new async job
- `getJobInfo()` - Get status of a specific job
- `getUserJobs()` - Get all jobs for a user

### 2. **Job Worker** (`JobWorker`)
**Location:** `db-explorer-api/src/workers/JobWorker.ts`

- Processes jobs from the queue asynchronously
- Supports multiple concurrent jobs (configurable via `WORKER_CONCURRENCY`)
- Reports progress during execution
- Handles errors and retries automatically

### 3. **Notification Service** (`NotificationService`)
**Location:** `db-explorer-api/src/services/NotificationService.ts`

- **Technology:** Server-Sent Events (SSE)
- **Features:**
  - Real-time one-way server-to-client communication
  - User-specific notification channels
  - Automatic heartbeat to keep connections alive
  - Connection management and cleanup

### 4. **Schema Training Service** (Enhanced)
**Location:** `db-explorer-api/src/services/SchemaTrainingService.ts`

- Added `trainSchemaWithOptions()` method for granular training
- Supports selective schema/table training
- Configurable metadata options (columns, types, constraints, indexes, foreign keys)
- Progress reporting during training

### 5. **Frontend Notification System**
**Locations:**
- `db-explorer-web/src/lib/notifications.ts` - SSE Client
- `db-explorer-web/src/hooks/useNotifications.ts` - React Hooks
- `db-explorer-web/src/components/notifications/JobNotificationListener.tsx` - Global Listener

**Features:**
- Automatic reconnection with exponential backoff
- React hooks for easy integration
- Toast notifications for job status updates

## Job Types

Currently supported job types (defined in `db-explorer-api/src/types/jobs.ts`):

- **`SCHEMA_TRAINING`** - Database schema training with customizable options

To add new job types:
1. Add to `JobType` enum in `types/jobs.ts`
2. Create job data interface extending `BaseJobData`
3. Add processor method in `JobWorker.ts`
4. Update `JobData` union type

## API Endpoints

### Job Management
- `POST /api/connections/:id/train-schema` - Queue schema training job (async)
- `GET /api/jobs/:jobId?jobType=<type>` - Get job status
- `GET /api/jobs` - Get all jobs for current user
- `GET /api/jobs/notifications/stream` - SSE endpoint for real-time notifications

### Schema Training
- `GET /api/connections/:id/schema-cache` - Get cached schema data
- `DELETE /api/connections/:id/schema-cache` - Delete schema cache

## Request/Response Flow

### 1. User Initiates Schema Training

```
User clicks "Start Training" in modal
  ↓
Frontend sends POST /api/connections/:id/train-schema with options
  ↓
Backend creates job and queues it
  ↓
Returns 202 Accepted with jobId
  ↓
Frontend shows "Job Queued" toast
```

### 2. Job Processing

```
Worker picks up job from queue
  ↓
Sets job status to "processing"
  ↓
Sends "job_started" notification via SSE
  ↓
Executes training with progress updates
  ↓
Sends "job_progress" notifications (10%, 20%, etc.)
  ↓
Completes and stores result
  ↓
Sends "job_completed" notification
```

### 3. User Receives Notification

```
SSE client receives notification
  ↓
React hook triggers callback
  ↓
JobNotificationListener shows toast
  ↓
User sees "Schema Training Complete" notification
```

## Configuration

### Backend Environment Variables

Add to `.env`:

```bash
# Redis Configuration (for async job queue)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Worker Configuration
WORKER_CONCURRENCY=5
```

### Frontend Environment Variables

Update `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Schema Training Modal Features

The enhanced re-train schema modal (`RetrainSchemaModal.tsx`) now supports:

### 1. **Schema Selection**
- View all available schemas/databases
- Select/deselect individual schemas
- Select all / Deselect all shortcuts

### 2. **Table Selection**
- Expandable accordion for each schema
- Checkbox selection for individual tables
- Automatic schema selection based on tables

### 3. **Training Options**
- **Include Columns** - Column names and properties
- **Include Types** - Data types for each column
- **Include Constraints** - Primary keys, unique constraints, etc.
- **Include Indexes** - Database indexes
- **Include Foreign Keys** - Foreign key relationships

### 4. **Real-time Feedback**
- Shows selection summary (X schemas, Y tables)
- Loading state while fetching schemas
- Progress indication during training
- Toast notifications for job status

## Scheduler Status

The **automatic weekly schema training scheduler has been disabled** to use the new async job system instead.

To re-enable the scheduler (if needed):

1. Uncomment lines in `db-explorer-api/src/index.ts`:
```typescript
// const cronExpression = process.env.SCHEMA_TRAINING_CRON || '0 2 * * 0';
// schemaTrainingScheduler.start(cronExpression);
// console.log(`📅 Schema training scheduler started (cron: ${cronExpression})`);
```

2. Uncomment shutdown calls:
```typescript
// schemaTrainingScheduler.stop();
```

## Benefits of This Architecture

### 1. **Scalability**
- Worker processes can be scaled horizontally
- Redis provides persistent job storage
- Multiple workers can process jobs concurrently

### 2. **Reliability**
- Automatic retries on failure
- Job persistence (survives server restarts)
- Error tracking and logging

### 3. **User Experience**
- Non-blocking API responses
- Real-time progress updates
- Continue working while jobs process

### 4. **Flexibility**
- Easy to add new job types
- Configurable job options
- Priority-based job processing

### 5. **Maintainability**
- Clean separation of concerns
- Type-safe with TypeScript
- Comprehensive error handling

## Development Workflow

### Adding a New Job Type

1. **Define job type:**
```typescript
// db-explorer-api/src/types/jobs.ts
export enum JobType {
  SCHEMA_TRAINING = 'schema_training',
  DATA_EXPORT = 'data_export', // New type
}

export interface DataExportJobData extends BaseJobData {
  type: JobType.DATA_EXPORT;
  connectionId: string;
  format: 'csv' | 'json' | 'xlsx';
}
```

2. **Add processor:**
```typescript
// db-explorer-api/src/workers/JobWorker.ts
await this.createWorker(JobType.DATA_EXPORT, this.processDataExport.bind(this));

private async processDataExport(job: Job<DataExportJobData>): Promise<any> {
  // Implementation
}
```

3. **Create API endpoint:**
```typescript
// db-explorer-api/src/controllers/DataExportController.ts
const jobId = await this.jobQueue.addJob(
  JobType.DATA_EXPORT,
  jobData,
  userId
);
```

4. **Add frontend integration:**
```typescript
// db-explorer-web/src/hooks/useNotifications.ts
useJobNotifications({
  onJobCompleted: (jobId, jobType, result) => {
    if (jobType === 'data_export') {
      toast.success('Export complete!');
    }
  }
});
```

## Testing

### Local Development

1. **Start Redis:**
```bash
docker run -d -p 6379:6379 redis:latest
```

2. **Start API Server:**
```bash
cd db-explorer-api
npm run dev
```

3. **Start Frontend:**
```bash
cd db-explorer-web
npm run dev
```

4. **Test the flow:**
- Open a connection
- Click "Re-train Schema"
- Select schemas/tables/options
- Click "Start Training"
- Watch for toast notifications

### Monitoring Jobs

Use Redis CLI to inspect job queues:
```bash
redis-cli
> KEYS bull:schema_training:*
> HGETALL bull:schema_training:1
```

## Troubleshooting

### Jobs Not Processing
- Check Redis connection: `REDIS_HOST` and `REDIS_PORT`
- Verify worker is running (check logs for "Job worker started")
- Check job queue initialization

### Notifications Not Received
- Verify SSE connection is established (check browser Network tab)
- Check authentication token is valid
- Verify `NotificationService` is initialized
- Add `<JobNotificationListener />` to your app layout

### Schema Training Fails
- Check database connection credentials
- Verify user has permissions to query schema metadata
- Check logs for specific error messages
- Review job error in Redis or via `/api/jobs/:jobId` endpoint

## Production Considerations

### Redis
- Use managed Redis (AWS ElastiCache, Redis Cloud, etc.)
- Enable persistence (RDB + AOF)
- Configure appropriate memory limits
- Set up monitoring and alerts

### Workers
- Run multiple worker instances for high availability
- Configure appropriate concurrency levels
- Monitor worker health and resource usage
- Set up error tracking (Sentry, etc.)

### SSE
- Use a reverse proxy (nginx, etc.) with proper SSE configuration
- Configure appropriate timeouts
- Handle connection limits
- Consider scaling strategy for many concurrent users

## Future Enhancements

Potential improvements to consider:

1. **Job Scheduling** - Support for delayed/scheduled jobs
2. **Job Priorities** - Different priority levels for different job types
3. **Job Dependencies** - Chain jobs together
4. **Batch Operations** - Process multiple items in a single job
5. **Job Cancellation** - Allow users to cancel running jobs
6. **Job History** - Persistent history of all completed jobs
7. **Admin Dashboard** - Web UI for monitoring all jobs
8. **Webhooks** - Notify external systems when jobs complete

## Credits

This async job architecture was built using:
- [BullMQ](https://docs.bullmq.io/) - Premium job queue for Node.js
- [Redis](https://redis.io/) - In-memory data store
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) - Real-time notifications
- [React Hooks](https://react.dev/reference/react) - Frontend state management

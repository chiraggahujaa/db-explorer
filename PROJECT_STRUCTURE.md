# DB Explorer - Project Structure

## Overview
DB Explorer is a modern database exploration and management platform with **authentication, user management, job processing, and AI-powered natural language database queries**. Users can query databases using natural language through the Vercel AI SDK integration with 42+ database tools.

## Core Features
- User registration and login (email/password)
- Email verification
- Password reset/forgot password
- User profile management
- Avatar upload
- JWT-based authentication
- Session management
- **AI-powered chat interface** using Vercel AI SDK with Gemini 2.5 Flash
- **Async job management** with pg-boss for long-running operations
- **Real-time notifications** via WebSocket and email
- Multi-database support (MySQL, PostgreSQL, SQLite, Supabase)
- Database connection management with role-based access control

---

## Backend Structure (`db-explorer-api/`)

```
db-explorer-api/
├── src/
│   ├── controllers/          # HTTP request handlers
│   │   ├── authController.ts        # Auth (register, login, logout, refresh)
│   │   ├── UserController.ts        # User profile operations
│   │   └── FileUploadController.ts  # Avatar/file uploads
│   │
│   ├── routes/              # API route definitions
│   │   ├── auth.ts          # /api/auth routes
│   │   ├── users.ts         # /api/users routes
│   │   └── files.ts         # /api/files routes
│   │
│   ├── middleware/          # Express middleware
│   │   └── security.ts      # CORS, rate limiting, helmet, etc.
│   │
│   ├── lib/                 # External service configurations
│   │   └── supabase.ts      # Supabase client setup
│   │
│   ├── types/               # TypeScript type definitions
│   ├── validations/         # Zod validation schemas
│   ├── utils/               # Utility functions
│   └── index.ts             # Main Express app entry point
│
├── supabase/
│   ├── migrations/          # Database schema migrations
│   │   ├── 20250107000001_create_users_table.sql
│   │   ├── 20250107000002_create_user_sessions_table.sql
│   │   └── 20250107000003_create_storage_buckets.sql
│   │
│   ├── rollbacks/           # Migration rollback scripts
│   │   ├── 20250107000001_create_users_table.down.sql
│   │   ├── 20250107000002_create_user_sessions_table.down.sql
│   │   └── 20250107000003_create_storage_buckets.down.sql
│   │
│   └── seed.sql             # Empty seed file (for future test data)
│
└── .env.development         # Environment variables

```

### Key Backend Files

**Controllers:**
- `authController.ts` - Registration, login, logout, token refresh, password reset
- `UserController.ts` - Get/update user profile
- `FileUploadController.ts` - Avatar and file upload handling

**Routes:**
- `/api/auth/*` - Authentication endpoints
- `/api/users/*` - User profile endpoints
- `/api/files/*` - File upload endpoints

**Database Tables:**
- `users` - User profiles (linked to auth.users)
- `user_sessions` - Active user sessions and refresh tokens
- Storage bucket: `avatars` - User profile pictures

---

## Frontend Structure (`db-explorer-web/`)

```
db-explorer-web/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (auth)/          # Auth pages (signin, signup, forgot-password)
│   │   │   ├── signin/
│   │   │   ├── signup/
│   │   │   ├── forgot-password/
│   │   │   └── verify-email/
│   │   │
│   │   ├── (private)/       # Protected routes
│   │   │   ├── dashboard/
│   │   │   └── profile/
│   │   │
│   │   ├── (public)/        # Public routes
│   │   │   └── page.tsx     # Landing page
│   │   │
│   │   └── layout.tsx       # Root layout
│   │
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── common/          # Shared components (LoadingSpinner, etc.)
│   │   ├── forms/           # Form components
│   │   └── layout/          # Layout components
│   │       └── Header/      # Navigation header
│   │
│   ├── features/            # Feature modules
│   │   ├── auth/            # Authentication feature
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   │
│   │   ├── profile/         # User profile feature
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   │
│   │   └── onboarding/      # User onboarding feature
│   │       └── components/
│   │
│   ├── hooks/               # Custom React hooks
│   │   └── useNestedFieldController.ts
│   │
│   ├── lib/                 # Utilities and configurations
│   │   ├── api/             # API client functions
│   │   │   ├── axios.ts     # Axios instance with interceptors
│   │   │   ├── auth.ts      # Auth API calls
│   │   │   ├── users.ts     # User API calls
│   │   │   └── files.ts     # File upload API calls
│   │   │
│   │   └── utils.ts         # Helper functions
│   │
│   ├── stores/              # Zustand state management
│   │   └── useAppStore.ts   # Global app state (user, loading, error)
│   │
│   ├── types/               # TypeScript types
│   │
│   └── providers/           # React context providers
│       └── query-provider.tsx
│
└── .env                     # Environment variables

```

### Key Frontend Features

**Authentication Pages:**
- `/signin` - Email/password login
- `/signup` - User registration
- `/forgot-password` - Password reset request
- `/verify-email` - Email verification

**Protected Pages:**
- `/dashboard` - User dashboard
- `/profile/:id` - User profile view/edit

**Public Pages:**
- `/` - Landing page with Sign In / Sign Up buttons

**Core State (useAppStore):**
```typescript
{
  user: User | null;
  isLoading: boolean;
  error: string | null;
}
```

---

## Job Management & Notification System

### Job Management
**PostgreSQL-based job queue using pg-boss:**
- Async job processing for long-running operations
- Job status tracking and progress monitoring
- Retry mechanism with exponential backoff
- Job prioritization and singleton keys
- Job cancellation and retry capabilities

**Job Types:**
- `schema-rebuild` - Async schema training/caching
- Future: `data-export`, `bulk-import`, `analytics-report`

**Job Services:**
- `JobService.ts` - Job queue management
- `schemaRebuildWorker.ts` - Schema rebuild worker
- `workers/index.ts` - Worker registry

### Notification System
**Multi-channel notification delivery:**
- In-app notifications (database-stored)
- Email notifications (via Resend)
- Real-time WebSocket notifications

**Notification Features:**
- User notification preferences
- Auto-expiration and cleanup
- Job event notifications (queued, started, completed, failed)
- Invitation notifications
- System alerts

**Notification Services:**
- `NotificationService.ts` - Notification delivery
- `WebSocketService.ts` - Real-time communication via Socket.IO

### Real-time Communication
**WebSocket server using Socket.IO:**
- User-specific notification rooms
- Job subscription mechanism
- Automatic reconnection support
- Event-driven architecture

**WebSocket Events:**
- `authenticate` - User authentication
- `notification` - New notification received
- `job:status` - Job status update
- `job:update` - Job event update

### AI Integration
**Vercel AI SDK with 42+ Database Tools:**
- Natural language to SQL conversion
- Query execution and result formatting
- Schema inspection and analysis
- Real-time streaming responses
- Multi-model support (Gemini 2.5 Flash, Claude, OpenAI)

**Database Tools:**
- Connection management
- Schema exploration
- Query execution
- Data modification
- Analytics and insights

---

## Database Schema

### `users` Table
```sql
- id (UUID, FK to auth.users)
- email (TEXT, UNIQUE)
- full_name (TEXT)
- phone (TEXT)
- avatar_url (TEXT)
- date_of_birth (DATE)
- gender (TEXT)
- bio (TEXT)
- is_active (BOOLEAN)
- email_verified (BOOLEAN)
- phone_verified (BOOLEAN)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

### `user_sessions` Table
```sql
- id (UUID, PK)
- user_id (UUID, FK to users)
- refresh_token (TEXT)
- user_agent (TEXT)
- ip_address (INET)
- expires_at (TIMESTAMPTZ)
- created_at (TIMESTAMPTZ)
- last_used_at (TIMESTAMPTZ)
```

### Storage Buckets
- `avatars` - Public bucket for user profile pictures (5MB limit, images only)

---

## API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/verify-email` - Verify email with token

### Users (`/api/users`)
- `GET /api/users/me` - Get current user profile
- `PATCH /api/users/me` - Update current user profile
- `GET /api/users/:id` - Get user by ID
- `PATCH /api/users/:id` - Update user by ID (admin)

### Files (`/api/files`)
- `POST /api/files/upload` - Upload file (avatar)
- `DELETE /api/files/:id` - Delete file

---

## Environment Variables

### Backend (`.env.development`)
```env
PORT=5000
NODE_ENV=development
API_BASE_URL=http://localhost:5000

SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000
```

### Frontend (`.env`)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_APP_NAME=DB Explorer
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=optional_google_oauth
```

### Job Management & WebSocket (Additional Backend Config)
```env
# Database password for pg-boss (required)
SUPABASE_DB_PASSWORD=your_database_password

# pg-boss configuration (optional - defaults shown)
PGBOSS_SCHEMA=pgboss
PGBOSS_ARCHIVE_COMPLETED_AFTER_SECONDS=86400  # 24 hours
PGBOSS_DELETE_ARCHIVED_AFTER_DAYS=30
PGBOSS_RETENTION_DAYS=7

# WebSocket configuration (optional)
WEBSOCKET_CORS_ORIGIN=http://localhost:3000
WEBSOCKET_PING_INTERVAL=25000  # 25 seconds
WEBSOCKET_PING_TIMEOUT=60000   # 60 seconds

# Job configuration (optional)
MAX_CONCURRENT_JOBS=5
JOB_TIMEOUT_MINUTES=30

# Notification configuration (optional)
NOTIFICATION_RETENTION_DAYS=90
EMAIL_NOTIFICATIONS_ENABLED=true

# Email service for notifications (required)
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@dbexplorer.com
EMAIL_FROM_NAME=DB Explorer
```

---

## Running the Project

### Backend
```bash
cd db-explorer-api
npm install
npm run dev  # Runs on http://localhost:5000
```

### Frontend
```bash
cd db-explorer-web
npm install
npm run dev  # Runs on http://localhost:3000
```

### Database Migrations
```bash
cd db-explorer-api
supabase link --project-ref YOUR_PROJECT_REF
npm run db:push
```

**Note:** The job management system migrations will be applied automatically via the migration file:
`20251127000001_create_notifications_system.sql`

---

## What Was Removed

All P2P marketplace features have been removed:
- ❌ Categories, items, products
- ❌ Bookings, rentals
- ❌ Cities, locations, addresses
- ❌ Proximity/radius search
- ❌ Date range selection
- ❌ Analytics, reviews, favorites
- ❌ Shopping cart
- ❌ User locations management

**This is now a clean authentication-focused application.**

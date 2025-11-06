# DB Explorer 2 - Clean Project Structure

## Overview
DB Explorer 2 is a modern database exploration and management platform with **authentication, user management, and chat-based database access**. Users can query databases using natural language through the MCP (Model Context Protocol) server.

## Core Features
- User registration and login (email/password)
- Email verification
- Password reset/forgot password
- User profile management
- Avatar upload
- JWT-based authentication
- Session management
- **Chat-based database access** via MCP server
- Multi-database support (MySQL, PostgreSQL, SQLite, Supabase)

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

## MCP Server Structure (`db-mcp/`)

```
db-mcp/
├── src/
│   ├── database/              # Database connectivity layer
│   │   ├── connectors/        # Database-specific connectors
│   │   │   ├── base.ts        # Base connector interface
│   │   │   ├── mysql.ts       # MySQL connector
│   │   │   ├── postgresql.ts  # PostgreSQL connector
│   │   │   ├── sqlite.ts      # SQLite connector
│   │   │   └── supabase.ts    # Supabase connector
│   │   ├── factories/         # Factory pattern for connectors
│   │   │   └── database-factory.ts
│   │   └── managers/          # Connection management
│   │       └── database-manager.ts
│   │
│   ├── tools/                 # MCP tools for database operations
│   │   ├── query.ts           # Query execution tools
│   │   ├── schema.ts          # Schema inspection tools
│   │   ├── modify.ts          # Data modification tools
│   │   ├── analysis.ts        # Database analysis tools
│   │   ├── security.ts        # Security-related tools
│   │   ├── tenant.ts          # Multi-tenant support
│   │   ├── utility.ts         # Utility tools
│   │   └── environment.ts    # Environment switching
│   │
│   ├── core/                  # Core functionality
│   │   ├── config/            # Configuration management
│   │   │   └── config-manager.ts
│   │   ├── constants/         # Constants and enums
│   │   │   └── index.ts
│   │   └── security/         # Security features
│   │       └── security-manager.ts
│   │
│   ├── types/                 # TypeScript type definitions
│   │   ├── common.ts          # Common types
│   │   ├── database.ts        # Database-specific types
│   │   └── index.ts
│   │
│   ├── config.ts              # Configuration loading
│   ├── constants.ts           # Application constants
│   ├── database.ts            # Database initialization
│   ├── security.ts            # Security initialization
│   └── server.ts              # MCP server implementation
│
├── index.ts                   # Entry point
├── package.json               # Bun dependencies
├── tsconfig.json              # TypeScript configuration
└── README.md                  # MCP server documentation
```

### Key MCP Server Features

**Database Connectors:**
- MySQL/MariaDB - Full SQL support with connection pooling
- PostgreSQL - Native support using Bun.sql with JSON/JSONB
- SQLite - File-based and in-memory databases
- Supabase - REST API integration with real-time capabilities

**MCP Tools:**
- `switch_environment` - Switch between configured databases
- `list_tables` - List all tables in a database
- `select_data` - Query data from tables
- `describe_table` - Get table schema information
- `execute_query` - Execute custom SQL queries (with validation)
- `analyze_database` - Database analysis and insights

**Security Features:**
- SQL injection detection and query validation
- Rate limiting and access controls
- Independent connection management with auto-retry
- Health monitoring with graceful degradation
- Audit logging and security reporting

**Configuration:**
- Uses numbered environment variables (`DB_TYPE_1`, `DB_HOST_1`, etc.)
- Automatic database discovery
- Multi-database support with independent connections
- Fault-tolerant architecture

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

### MCP Server (`db-mcp/.env`)
```env
# MySQL Example
DB_TYPE_1=mysql
DB_HOST_1=localhost
DB_PORT_1=3306
DB_USER_1=username
DB_PASSWORD_1=password
DB_NAME_1=database_name

# PostgreSQL Example
DB_TYPE_2=postgresql
DB_CONNECTION_STRING_2=postgresql://user:pass@host:5432/dbname

# SQLite Example
DB_TYPE_3=sqlite
DB_FILE_3=/path/to/database.db

# Supabase Example
DB_TYPE_4=supabase
DB_PROJECT_URL_4=https://your-project.supabase.co
DB_ANON_KEY_4=your_anon_key

# Global settings
DEFAULT_DATABASE=db_1
READ_ONLY_MODE=false
MAX_QUERY_RESULTS=1000
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

### MCP Server
```bash
cd db-mcp
bun install
cp .env.example .env
# Configure .env with your database connections
bun run start
```

**Claude Desktop Integration:**
Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "db-mcp": {
      "command": "/Users/{user}/.bun/bin/bun",
      "args": ["run", "start"],
      "cwd": "/path/to/db-explorer-2/db-mcp",
      "env": {
        "DB_TYPE_1": "mysql",
        "DB_HOST_1": "localhost",
        ...
      }
    }
  }
}
```

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

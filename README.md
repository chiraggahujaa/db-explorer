# DB Explorer

A modern database exploration and management platform with comprehensive user authentication, profile management, and chat-based database access. Query your databases using natural language through our AI-powered MCP server.

## Features

- **User Authentication**
  - Email/password signup and login
  - Phone OTP authentication
  - Google OAuth integration
  - JWT-based session management
  - Password reset and email verification
  - Token refresh mechanism

- **User Management**
  - Complete user profile system
  - Profile editing with tabs (Details, Security, Address Book)
  - Avatar upload and management
  - Address management
  - Profile completion tracking

- **Modern UI/UX**
  - Built with Next.js 15+ and React 19
  - Tailwind CSS 4 for styling
  - shadcn/ui component library
  - Responsive design
  - Dark mode support (via next-themes)
  - Toast notifications (Sonner)

- **State Management**
  - Zustand for global state
  - TanStack Query for server state
  - Persistent storage support

- **Form Handling**
  - React Hook Form integration
  - Zod schema validation
  - Real-time validation feedback
  - Nested object field support

- **Chat-Based Database Access**
  - AI-powered natural language queries
  - MCP (Model Context Protocol) server integration
  - Support for MySQL, PostgreSQL, SQLite, and Supabase
  - Secure query execution with validation

## Tech Stack

### Frontend (db-explorer-web)
- **Framework**: Next.js 15+ with App Router
- **UI**: Tailwind CSS 4 + shadcn/ui (Radix UI)
- **State**: Zustand + TanStack Query
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React
- **Notifications**: Sonner

### Backend (db-explorer-api)
- **Runtime**: Node.js + TypeScript (ES Modules)
- **Framework**: Express.js v5
- **Database**: Supabase (PostgreSQL)
- **Validation**: Zod
- **Testing**: Cypress (E2E)

### MCP Server (db-mcp)
- **Runtime**: Bun
- **Protocol**: Model Context Protocol (MCP)
- **Database Support**: MySQL, PostgreSQL, SQLite, Supabase
- **Features**: Natural language queries, SQL injection protection, fault-tolerant connections

## Project Structure

```
db-explorer/
├── db-explorer-web/          # Next.js frontend application
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   │   ├── (auth)/       # Authentication pages (signin, signup, etc.)
│   │   │   ├── (private)/    # Protected routes (dashboard, profile, etc.)
│   │   │   └── (public)/     # Public routes (home, etc.)
│   │   ├── components/       # Shared UI components
│   │   │   ├── ui/           # shadcn/ui components
│   │   │   ├── common/       # Common components (LoadingSpinner, etc.)
│   │   │   ├── forms/        # Form components
│   │   │   └── layout/       # Layout components (Header, etc.)
│   │   ├── features/         # Feature-based modules
│   │   │   ├── auth/         # Authentication feature
│   │   │   ├── profile/      # User profile feature
│   │   │   └── onboarding/   # User onboarding feature
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities and configurations
│   │   │   └── api/          # API client functions
│   │   ├── stores/           # Zustand stores
│   │   ├── types/            # TypeScript type definitions
│   │   └── providers/        # React context providers
│   └── public/               # Static assets
│
├── db-explorer-api/          # Express.js backend API
│   ├── src/
│   │   ├── controllers/      # HTTP request handlers
│   │   ├── services/         # Business logic layer
│   │   ├── routes/           # API route definitions
│   │   ├── middleware/       # Express middleware
│   │   ├── types/            # TypeScript type definitions
│   │   ├── validations/      # Zod validation schemas
│   │   ├── utils/            # Utility functions
│   │   └── lib/              # External library configurations
│   ├── supabase/             # Database migrations and schema
│   │   └── migrations/       # SQL migration files
│   └── scripts/              # Utility scripts
│
├── db-mcp/                   # MCP server for chat-based database access
│   ├── src/
│   │   ├── database/         # Database connectors and managers
│   │   ├── tools/            # MCP tools for database operations
│   │   ├── core/             # Core functionality (config, security)
│   │   └── types/            # TypeScript type definitions
│   ├── index.ts              # MCP server entry point
│   └── package.json          # Bun dependencies
│
└── CLAUDE.md                 # Project instructions and documentation
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Bun runtime (for db-mcp server) - [Install Bun](https://bun.sh)
- Supabase account (for database and auth)
- Google OAuth credentials (optional, for Google sign-in)

### 1. Clone and Setup

```bash
cd db-explorer
```

### 2. Backend Setup

```bash
cd db-explorer-api
npm install

# Copy environment variables
cp .env.example .env

# Configure your .env file with:
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - PORT (default: 5000)

# Run migrations (if using Supabase locally)
npm run supabase:start
npm run db:push

# Start development server
npm run dev
```

The API will be running at `http://localhost:5000`

### 3. Frontend Setup

```bash
cd db-explorer-web
npm install

# Copy environment variables
cp .env.example .env.local

# Configure your .env.local file with:
# - NEXT_PUBLIC_API_URL (e.g., http://localhost:5000/api)
# - NEXT_PUBLIC_GOOGLE_CLIENT_ID (optional, for Google OAuth)

# Start development server
npm run dev
```

The web app will be running at `http://localhost:3000`

### 4. MCP Server Setup (db-mcp)

```bash
cd db-mcp
bun install

# Copy environment variables
cp .env.example .env

# Configure your .env file with database connections:
# DB_TYPE_1=mysql|postgresql|sqlite|supabase
# DB_HOST_1=localhost
# DB_PORT_1=3306
# DB_USER_1=username
# DB_PASSWORD_1=password
# DB_NAME_1=database_name
# (See db-mcp/README.md for full configuration options)

# Start MCP server
bun run start
```

The MCP server enables chat-based database access through Claude Desktop or other MCP-compatible clients.

## Environment Variables

### Backend (.env)
```env
NODE_ENV=development
PORT=5000

# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

### MCP Server (db-mcp/.env)
```env
# Database connections (numbered pattern)
DB_TYPE_1=mysql
DB_HOST_1=localhost
DB_PORT_1=3306
DB_USER_1=username
DB_PASSWORD_1=password
DB_NAME_1=database_name

# Global settings
DEFAULT_DATABASE=db_1
READ_ONLY_MODE=false
MAX_QUERY_RESULTS=1000
```

See [db-mcp/README.md](./db-mcp/README.md) for detailed configuration options for different database types.

## Available Scripts

### Frontend (db-explorer-web)
```bash
npm run dev          # Start development server with Turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run type-check   # TypeScript type checking
```

### Backend (db-explorer-api)
```bash
npm run dev                  # Start development server
npm run build                # Build TypeScript to JavaScript
npm run start                # Start production server
npm run typecheck            # TypeScript type checking

# Database
npm run db:push              # Push migrations to database
npm run db:reset             # Reset database with fresh data
npm run supabase:generate    # Generate TypeScript types from database

# Testing
npm test                     # Run all tests
npm run test:auth            # Run authentication tests
npm run test:users           # Run user tests
```

### MCP Server (db-mcp)
```bash
bun run start                # Start MCP server
bun run dev                  # Start in watch mode
bun run build                # Build for production
bun run typecheck            # TypeScript type checking
```

## Key Features Implementation

### Authentication Flow
1. User signs up via email/password or Google OAuth
2. Backend validates and creates user in Supabase
3. JWT tokens (access + refresh) returned to client
4. Tokens stored in localStorage/sessionStorage
5. Axios interceptor adds Bearer token to requests
6. Auto token refresh on 401 responses

### Protected Routes
- Routes in `(private)` folder require authentication
- `RootAuthGuard` component checks auth status
- Redirects to signin if not authenticated
- Redirects to onboarding if profile incomplete

### User Profile Management
- Tabbed interface for different profile sections
- Real-time form validation with Zod
- Optimistic updates with TanStack Query
- Avatar upload with preview
- Address management with autocomplete

## API Documentation

See [db-explorer-api/CLAUDE.md](./db-explorer-api/CLAUDE.md) for detailed API documentation including:
- Available endpoints
- Request/response formats
- Authentication requirements
- Validation schemas
- Database schema

## Frontend Documentation

See [db-explorer-web/CLAUDE.md](./db-explorer-web/CLAUDE.md) for detailed frontend documentation including:
- Component patterns
- State management
- Form handling
- Routing structure
- Code organization

## MCP Server Documentation

See [db-mcp/README.md](./db-mcp/README.md) for detailed MCP server documentation including:
- Database connection setup
- Claude Desktop integration
- Available MCP tools
- Security features
- Configuration options

## Contributing

1. Follow the code patterns documented in CLAUDE.md files
2. Use feature-based organization for new features
3. Write tests for new functionality
4. Ensure type safety with TypeScript
5. Follow the commit message guidelines (no AI attribution)

## License

ISC

---

Built with modern web technologies and best practices for a scalable, maintainable application.

# DB Explorer Web - Development Guide

## Project Overview

DB Explorer Web is a modern Next.js 15 application built with TypeScript, featuring AI-powered database exploration using Vercel AI SDK, comprehensive user authentication, and a sophisticated dark mode implementation.

**Tech Stack:**
- **Framework**: Next.js 15.5.2 with App Router & Turbopack
- **Language**: TypeScript 5.9 (strict mode)
- **Styling**: Tailwind CSS 4 with OKLch colors
- **UI Components**: shadcn/ui (36+ Radix UI primitives)
- **State Management**: Zustand 5 + React Query 5
- **Forms**: React Hook Form 7 + Zod 4
- **AI Integration**: Vercel AI SDK v5 with Gemini 2.5 Flash (42 database tools)
- **Auth**: JWT with automatic token refresh
- **Icons**: Lucide React
- **Notifications**: Sonner (toasts)

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Configure: NEXT_PUBLIC_API_URL, NEXT_PUBLIC_GOOGLE_CLIENT_ID, NEXT_PUBLIC_GEMINI_API_KEY

# Development with Turbopack
npm run dev

# Production build
npm run build
npm start

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Pre-commit validation
npm run validate
```

## Project Structure

```
db-explorer-web/
├── src/
│   ├── app/                          # Next.js App Router (file-based routing)
│   │   ├── (auth)/                   # Auth routes (signin, signup, reset-password)
│   │   ├── (private)/                # Protected routes (dashboard, profile, onboarding)
│   │   ├── (public)/                 # Public routes (home, email-confirmation)
│   │   ├── api/                      # API routes
│   │   │   └── chat/route.ts         # Vercel AI SDK chat endpoint (42 DB tools)
│   │   ├── layout.tsx                # Root layout with providers
│   │   ├── globals.css               # Tailwind 4 + dark mode CSS
│   │   └── loading.tsx               # Global loading state
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components (button, dialog, input, etc.)
│   │   ├── layout/Header/            # Application header
│   │   ├── theme/ThemeToggle.tsx     # Dark mode toggle
│   │   ├── connections/              # Domain-specific components
│   │   │   ├── ChatInterfaceNew.tsx  # Main chat UI with AI
│   │   │   ├── ExplorerSidebar.tsx   # DB schema tree explorer
│   │   │   ├── ConnectionModal.tsx   # Create/edit connections
│   │   │   └── ToolCallsSidebar.tsx  # Display AI tool calls
│   │   ├── forms/                    # Form components
│   │   └── common/                   # Shared components (LoadingPage, LoadingSpinner)
│   │
│   ├── features/                     # Feature modules (organized by domain)
│   │   ├── auth/
│   │   │   ├── components/           # Auth-specific components
│   │   │   ├── hooks/useAuth.ts      # Authentication hook
│   │   │   ├── types/                # Auth type definitions
│   │   │   └── validations/          # Zod validation schemas
│   │   ├── profile/
│   │   │   ├── hooks/                # Profile-related hooks
│   │   │   ├── components/           # Profile components
│   │   │   └── validations/          # Profile validation schemas
│   │   └── onboarding/               # User onboarding flow
│   │
│   ├── lib/                          # Core utilities and configurations
│   │   ├── api/                      # API clients (organized by domain)
│   │   │   ├── axios.ts              # Axios instance with interceptors
│   │   │   ├── auth.ts               # Auth API calls
│   │   │   ├── connections.ts        # Database connections API
│   │   │   ├── chatSessions.ts       # Chat sessions API
│   │   │   └── users.ts              # User management API
│   │   ├── prompts/
│   │   │   └── database-assistant-prompt.ts  # AI system prompts
│   │   ├── utils/
│   │   │   ├── route-utils.ts        # Route protection helpers
│   │   │   └── ui.ts                 # UI utilities (cn function)
│   │   └── schema-formatter.ts       # Schema formatting for AI context
│   │
│   ├── stores/                       # Zustand state stores
│   │   ├── useAppStore.ts            # Global app state (user, auth)
│   │   └── useChatStore.ts           # Chat session state
│   │
│   ├── providers/                    # React context providers
│   │   ├── QueryProvider.tsx         # React Query provider
│   │   └── ThemeProvider.tsx         # next-themes provider
│   │
│   ├── contexts/                     # React contexts
│   │   └── ConnectionExplorerContext.tsx  # DB explorer state
│   │
│   ├── types/                        # TypeScript type definitions
│   │   ├── connection.ts             # Database connection types
│   │   ├── user.ts                   # User types
│   │   ├── api.ts                    # API response types
│   │   └── users-api.ts              # Users API types
│   │
│   ├── utils/                        # Helper utilities
│   │   ├── sqlExtractor.ts           # Extract SQL from AI responses
│   │   ├── contextManager.ts         # Manage chat context
│   │   ├── chatPrompts.ts            # Chat prompt helpers
│   │   └── resultParser.ts           # Parse DB results
│   │
│   └── hooks/                        # Custom React hooks
│       └── useNestedFieldController.ts  # Nested form field control
│
├── package.json                      # Dependencies and scripts
├── tsconfig.json                     # TypeScript configuration
├── next.config.ts                    # Next.js configuration
├── postcss.config.mjs                # PostCSS with Tailwind 4
├── DARK_MODE.md                      # Dark mode documentation
└── CLAUDE.md                         # This file
```

## Architecture & Design Patterns

### 1. Route Organization

**Route Groups** (parallel routes for layout control):
- **(auth)**: Public authentication pages (`/signin`, `/signup`, `/reset-password`, `/verify-email`)
- **(private)**: Protected pages requiring authentication (`/dashboard`, `/profile`, `/onboarding`)
- **(public)**: Public pages (`/`, `/email-confirmation`, `/invitations`)

**Dynamic Routes**:
- `/dashboard/connections/[id]` - Connection detail page
- `/profile/[id]` - User profile page

**Route Protection** (`src/features/auth/components/RootAuthGuard.tsx`):
```tsx
// Automatically redirects based on auth state and route type
// - Unauthenticated users → /signin (for private routes)
// - Authenticated users → / (for auth routes)
// - Prevents flash of unauthorized content
```

### 2. Component Architecture

**Component Hierarchy**:
1. **Server Components** (default) - Use for static content, data fetching
2. **Client Components** (`"use client"`) - Use for interactivity, hooks, browser APIs

**shadcn/ui Pattern**:
- All UI components in `src/components/ui/`
- Built on Radix UI primitives with Tailwind styling
- Fully typed, accessible, and dark mode compatible
- Examples: `Button`, `Dialog`, `Select`, `DropdownMenu`, `Input`, `Checkbox`

**Custom Reusable Components**:

1. **SearchableSelect** (`src/components/ui/searchable-select.tsx`)
   ```tsx
   // Combobox with search functionality
   import { SearchableSelect } from '@/components/ui/searchable-select';

   <SearchableSelect
     options={schemas.map(s => ({ value: s.name, label: s.name }))}
     value={selectedSchema}
     onValueChange={setSelectedSchema}
     placeholder="Select schema..."
     isLoading={loading}
   />
   ```

2. **SearchInput** (`src/components/ui/search-input.tsx`)
   ```tsx
   // Input with icon support
   import { SearchInput } from '@/components/ui/search-input';

   <SearchInput
     placeholder="Search tables..."
     value={search}
     onChange={(e) => setSearch(e.target.value)}
     icon={<SearchIcon />}
     iconPosition="left"
   />
   ```

3. **ThemeToggle** (`src/components/theme/ThemeToggle.tsx`)
   ```tsx
   // Dark mode switcher (light/dark/system)
   import { ThemeToggle } from '@/components/theme/ThemeToggle';

   <ThemeToggle />  // Used in header
   ```

**Component Naming Conventions**:
- PascalCase for component files and names
- Descriptive names (e.g., `ConnectionModal`, `ExplorerSidebar`)
- Suffix with component type when needed (e.g., `SignInForm`, `UserAvatar`)

### 3. State Management

**Zustand Stores** (Global State):

**useAppStore** (`src/stores/useAppStore.ts`) - User & Auth State
```tsx
import { useAppStore } from '@/stores/useAppStore';

// In component
const { user, isLoading, setUser, logout, setTokens, clearTokens } = useAppStore();

// State shape:
interface AppState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  logout: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearTokens: () => void;
}

// Features:
// - Persists user to localStorage (via persist middleware)
// - DevTools integration for debugging
// - Automatic cleanup on logout
```

**useChatStore** (`src/stores/useChatStore.ts`) - Chat Session State
```tsx
import { useChatStore } from '@/stores/useChatStore';

// In component
const {
  currentChatSessionId,
  chatHistory,
  createNewChat,
  loadChatHistory,
  saveChatMessages
} = useChatStore();

// State shape:
interface ChatState {
  currentChatSessionId: string | null;
  currentChatSession: ChatSession | null;
  chatHistory: ChatMessage[];
  createNewChat: (connectionId, schema?, tables?, config?) => Promise<ChatSession | null>;
  loadChatHistory: (chatSessionId) => Promise<void>;
  saveChatMessages: (userMsg, assistantMsg, toolCalls?) => Promise<void>;
  updateChatTitle: (title) => Promise<void>;
  clearCurrentChat: () => void;
}
```

**React Query** (`src/providers/QueryProvider.tsx`) - Server State:
```tsx
// Configuration:
{
  staleTime: 60 * 1000,         // 1 minute
  gcTime: 10 * 60 * 1000,       // 10 minutes (cache time)
  retry: (failCount, error) => failCount < 3 && !is4xx(error),
  refetchOnWindowFocus: false,  // Don't auto-refetch
}

// Usage:
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const { data, isLoading, error } = useQuery({
  queryKey: ['connections', userId],
  queryFn: () => connectionsAPI.getMyConnections(),
});

const mutation = useMutation({
  mutationFn: connectionsAPI.createConnection,
  onSuccess: () => queryClient.invalidateQueries(['connections']),
});
```

**Context API** (Component-specific state):
```tsx
// Example: ConnectionExplorerContext
// Use for sharing state within a component subtree
import { ConnectionExplorerContext } from '@/contexts/ConnectionExplorerContext';

const { selectedSchema, selectedTables, toggleTable } = useConnectionExplorer();
```

### 4. TypeScript Conventions

**Type Organization**:
- Domain types in `src/types/` (e.g., `connection.ts`, `user.ts`, `api.ts`)
- Feature-specific types in feature folders (e.g., `src/features/auth/types/`)
- Component prop types inline or in same file

**Naming Conventions**:
- Interfaces: `PascalCase` (no "I" prefix)
  ```tsx
  interface User { ... }
  interface DatabaseConnection { ... }
  ```
- Types: `PascalCase`
  ```tsx
  type DatabaseType = 'mysql' | 'postgresql' | 'sqlite' | 'supabase';
  type ConnectionRole = 'owner' | 'admin' | 'developer' | 'tester' | 'viewer';
  ```
- Generics: Single uppercase letter or descriptive PascalCase
  ```tsx
  function identity<T>(arg: T): T { ... }
  function apiCall<TResponse>(url: string): Promise<ApiResponse<TResponse>> { ... }
  ```

**Type Patterns**:

1. **Discriminated Unions**:
   ```tsx
   // Connection configs by type
   type ConnectionConfig =
     | SQLConnectionConfig
     | SQLiteConnectionConfig
     | SupabaseConnectionConfig;

   interface SQLConnectionConfig {
     type: 'mysql' | 'postgresql';  // Discriminator
     host: string;
     port: number;
     // ... other fields
   }
   ```

2. **Utility Types**:
   ```tsx
   type PartialUser = Partial<User>;
   type UserWithoutId = Omit<User, 'id'>;
   type UserIdAndEmail = Pick<User, 'id' | 'email'>;
   type ReadonlyUser = Readonly<User>;
   ```

3. **Zod Schema Inference**:
   ```tsx
   import { z } from 'zod';

   const loginSchema = z.object({
     email: z.string().email(),
     password: z.string().min(8),
   });

   type LoginFormData = z.infer<typeof loginSchema>;
   ```

**TypeScript Config** (`tsconfig.json`):
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "strict": true,                    // ✅ Strict mode enabled
    "moduleResolution": "bundler",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]               // ✅ Path alias
    }
  }
}
```

### 5. Styling System

**Tailwind CSS 4** (`src/app/globals.css`):

```css
@import "tailwindcss";
@import "tw-animate-css";

/* Dark mode variant */
@custom-variant dark (&:is(.dark *));

/* Theme configuration */
@theme inline {
  --color-primary: var(--primary);
  --color-background: var(--background);
  --radius-lg: var(--radius);
}

/* Light mode (default) */
:root {
  --radius: 0.75rem;
  --background: oklch(1 0 0);           /* White */
  --foreground: oklch(0.15 0.015 270);  /* Dark gray */
  --primary: oklch(0.55 0.22 264);      /* Blue */
  --border: oklch(0.90 0.01 270);       /* Light gray */
  /* ... more semantic tokens */
}

/* Dark mode */
.dark {
  --background: oklch(0.12 0.01 270);   /* Very dark neutral */
  --foreground: oklch(0.92 0.01 270);   /* Light gray */
  --primary: oklch(0.60 0.20 264);      /* Vibrant blue */
  --card: oklch(0.17 0.012 270);        /* Elevated dark surface */
  --border: oklch(0.28 0.02 270);       /* Subtle border */
  /* ... more semantic tokens */
}
```

**CRITICAL STYLING RULES**:

1. **ALWAYS Use Semantic Color Tokens** (NEVER hardcode colors):
   ```tsx
   // ✅ GOOD - Uses semantic tokens
   <div className="bg-background text-foreground border-border">
   <Button className="bg-primary text-primary-foreground" />

   // ❌ BAD - Hardcoded colors (breaks dark mode)
   <div className="bg-white text-black border-gray-200">
   <Button className="bg-blue-500 text-white" />
   ```

2. **Available Semantic Tokens**:
   - `background` / `foreground` - Page background and text
   - `card` / `card-foreground` - Card surfaces
   - `primary` / `primary-foreground` - Primary actions
   - `secondary` / `secondary-foreground` - Secondary actions
   - `muted` / `muted-foreground` - Muted/disabled states
   - `accent` / `accent-foreground` - Accent highlights
   - `destructive` - Destructive actions (delete, errors)
   - `border` - Border colors
   - `input` - Input field borders
   - `ring` - Focus ring colors

3. **Dark Mode Variants**:
   ```tsx
   // Use dark: prefix for dark mode overrides (only when needed)
   <div className="bg-background dark:bg-background" />
   <p className="text-foreground dark:text-foreground" />

   // Most components auto-adapt via semantic tokens
   <Card>  // Automatically uses bg-card/text-card-foreground
   ```

4. **Class Merging Utility** (`src/utils/ui.ts`):
   ```tsx
   import { cn } from '@/utils/ui';

   // Merges classes, resolves conflicts (Tailwind classes)
   <div className={cn(
     'px-4 py-2',
     isActive && 'bg-primary text-primary-foreground',
     className  // Accepts additional classes from props
   )} />
   ```

5. **Component Variants** (using `class-variance-authority`):
   ```tsx
   import { cva, type VariantProps } from 'class-variance-authority';

   const buttonVariants = cva(
     'inline-flex items-center justify-center rounded-md',  // Base classes
     {
       variants: {
         variant: {
           default: 'bg-primary text-primary-foreground',
           destructive: 'bg-destructive text-white',
           outline: 'border bg-background',
           ghost: 'hover:bg-accent',
         },
         size: {
           default: 'h-9 px-4 py-2',
           sm: 'h-8 px-3',
           lg: 'h-10 px-6',
           icon: 'size-9',
         },
       },
       defaultVariants: {
         variant: 'default',
         size: 'default',
       },
     }
   );
   ```

**Dark Mode Implementation**:
- Uses `next-themes` library with automatic localStorage persistence
- ThemeProvider wraps app in `layout.tsx`
- System preference detection enabled
- No FOUC (Flash of Unstyled Content)
- See `DARK_MODE.md` for complete documentation

### 6. Form Handling

**React Hook Form + Zod Pattern**:

1. **Define Validation Schema** (`src/features/auth/validations/index.ts`):
   ```tsx
   import { z } from 'zod';

   const emailSchema = z.string().min(1, 'Email is required').email('Invalid email');

   const passwordSchema = z
     .string()
     .min(8, 'Password must be at least 8 characters')
     .regex(
       /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
       'Must include uppercase, lowercase, and number'
     );

   export const loginSchema = z.object({
     email: emailSchema,
     password: z.string().min(1, 'Password is required'),
   });

   export const registerSchema = z.object({
     name: z.string().min(2).max(50),
     email: emailSchema,
     password: passwordSchema,
     confirmPassword: z.string(),
   }).refine(data => data.password === data.confirmPassword, {
     message: 'Passwords do not match',
     path: ['confirmPassword'],
   });

   // Infer TypeScript type from schema
   export type LoginFormData = z.infer<typeof loginSchema>;
   export type RegisterFormData = z.infer<typeof registerSchema>;
   ```

2. **Use in Component**:
   ```tsx
   import { useForm } from 'react-hook-form';
   import { zodResolver } from '@hookform/resolvers/zod';
   import { loginSchema, type LoginFormData } from '@/features/auth/validations';

   function SignInForm() {
     const {
       register,           // Register input fields
       handleSubmit,       // Form submission handler
       watch,              // Watch field values
       setValue,           // Programmatically set values
       reset,              // Reset form
       formState: { errors, isSubmitting }  // Form state
     } = useForm<LoginFormData>({
       resolver: zodResolver(loginSchema),  // Integrate Zod validation
       defaultValues: {
         email: '',
         password: '',
       },
     });

     const onSubmit = async (data: LoginFormData) => {
       try {
         await loginAPI.login(data);
       } catch (error) {
         // Handle error
       }
     };

     return (
       <form onSubmit={handleSubmit(onSubmit)}>
         <div>
           <Label htmlFor="email">Email</Label>
           <Input
             id="email"
             type="email"
             {...register('email')}
           />
           {errors.email && (
             <span className="text-sm text-destructive">{errors.email.message}</span>
           )}
         </div>

         <div>
           <Label htmlFor="password">Password</Label>
           <Input
             id="password"
             type="password"
             {...register('password')}
           />
           {errors.password && (
             <span className="text-sm text-destructive">{errors.password.message}</span>
           )}
         </div>

         <Button type="submit" disabled={isSubmitting}>
           {isSubmitting ? 'Signing in...' : 'Sign In'}
         </Button>
       </form>
     );
   }
   ```

3. **Reactive Field Watching** (Conditional Fields):
   ```tsx
   const dbType = watch('dbType');  // Watch field value

   // Show different fields based on dbType
   {dbType === 'mysql' && (
     <>
       <Input {...register('host')} />
       <Input {...register('port')} />
     </>
   )}

   {dbType === 'sqlite' && (
     <Input {...register('filePath')} />
   )}
   ```

### 7. API Integration

**Axios Configuration** (`src/lib/api/axios.ts`):

```tsx
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: Add Bearer token
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('access_token') || sessionStorage.getItem('access_token')
    : null;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Response interceptor: Handle 401 + token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 errors (unauthorized)
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/api/auth/refresh')
    ) {
      originalRequest._retry = true;

      // Try to refresh token
      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const response = await api.post('/api/auth/refresh', { refreshToken });
          const { access_token, refresh_token } = response.data.data.session;

          // Store new tokens
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch {
          // Refresh failed, clear tokens
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

**API Client Pattern** (Domain-based organization):

```tsx
// src/lib/api/auth.ts
import api from './axios';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post<ApiResponse<{ user: User; session: Session }>>(
      '/api/auth/login',
      { email, password }
    );
    return response.data;
  },

  register: async (name: string, email: string, password: string) => {
    const response = await api.post<ApiResponse<{ user: User }>>(
      '/api/auth/register',
      { name, email, password }
    );
    return response.data;
  },

  logout: async () => {
    const response = await api.post<ApiResponse<void>>('/api/auth/logout');
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get<ApiResponse<User>>('/api/auth/me');
    return response.data;
  },

  refreshToken: async (refreshToken: string) => {
    const response = await api.post<ApiResponse<{ session: Session }>>(
      '/api/auth/refresh',
      { refreshToken }
    );
    return response.data;
  },
};
```

**API Clients** (organized by domain in `src/lib/api/`):
- `auth.ts` - Authentication (login, register, logout, getProfile, refreshToken, googleAuth)
- `connections.ts` - Database connections (CRUD, members, invitations, schemas, tables)
- `chatSessions.ts` - Chat sessions (create, get, addMessage, updateTitle, generateTitle)
- `users.ts` - User management (getUsers, getUser, updateUser, deleteUser)

### 8. AI Integration (Vercel AI SDK)

**Chat API Route** (`src/app/api/chat/route.ts`):

```tsx
import { streamText, tool, convertToCoreMessages } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { messages, connectionId, userId, selectedSchema, chatConfig } = await req.json();

  // Build system prompt
  const systemPrompt = getDatabaseAssistantPrompt(selectedSchema, chatConfig);

  // Define 42 database tools
  const tools = {
    list_databases: tool({
      description: 'List all available databases/schemas',
      inputSchema: z.object({
        connection: z.string().optional(),
      }),
      execute: async (input) => {
        // ... implementation
      }
    }),

    select_data: tool({
      description: 'Execute SELECT query with filtering, sorting, pagination',
      inputSchema: z.object({
        table: z.string(),
        columns: z.array(z.string()).optional(),
        where: z.string().optional(),
        orderBy: z.string().optional(),
        limit: z.number().optional(),
        database: z.string(),
      }),
      execute: async (input) => {
        // Apply row limit from chat config
        const configLimit = chatConfig?.resultRowLimit || 100;
        const effectiveLimit = Math.min(input.limit || configLimit, configLimit);
        // ... query execution
      }
    }),

    // ... 40 more tools (insert, update, delete, join, analyze, etc.)
  };

  // Stream response
  const result = await streamText({
    model: google('gemini-2.5-flash'),
    system: systemPrompt,
    messages: convertToCoreMessages(messages),
    tools,
    maxSteps: 10,  // Enable multi-step tool execution
    temperature: 0.7,
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
  });
}
```

**Client-side Chat** (`src/components/connections/ChatInterfaceNew.tsx`):

```tsx
import { useChat } from '@ai-sdk/react';

function ChatInterfaceNew({ connectionId }) {
  const {
    messages,           // Chat messages (user + assistant)
    input,              // Current input value
    handleInputChange,  // Input change handler
    handleSubmit,       // Form submit handler
    isLoading,          // Loading state
    error,              // Error state
  } = useChat({
    api: '/api/chat',
    body: {
      connectionId,
      userId: user?.id,
      selectedSchema,
      chatConfig,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    onFinish: (message) => {
      // Save message to backend
      saveChatMessages(input, message.content, message.toolCalls);
    },
  });

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'user' ? (
              <UserMessage content={msg.content} />
            ) : (
              <AssistantMessage
                content={msg.content}
                toolCalls={msg.toolCalls}
              />
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit}>
        <Input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask anything about your database..."
          disabled={isLoading}
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Thinking...' : 'Send'}
        </Button>
      </form>
    </div>
  );
}
```

**42 Database Tools Available**:
- **Schema & Structure**: list_databases, list_tables, describe_table, show_indexes, analyze_foreign_keys, get_table_dependencies
- **Data Query**: select_data, count_records, find_by_id, search_records, get_recent_records, execute_custom_query
- **Data Modification**: insert_record, update_record, delete_record, bulk_insert (respects read-only mode)
- **Analysis**: join_tables, find_orphaned_records, validate_referential_integrity, analyze_table_relationships, get_column_statistics
- **Tenant Management**: list_tenants, switch_tenant_context, get_tenant_schema, compare_tenant_data, get_tenant_tables
- **Utilities**: explain_query, check_table_status, optimize_table, backup_table_structure, test_connection, show_connections, get_database_size

### 9. Error Handling & User Feedback

**Error Handling Patterns**:

1. **Try-Catch with Toast Notifications**:
   ```tsx
   import { toast } from 'sonner';

   async function handleAction() {
     try {
       await someAPI.call();
       toast.success('Action completed successfully');
     } catch (error) {
       const message = error instanceof Error ? error.message : 'An error occurred';
       toast.error(message);
       console.error('Action failed:', error);
     }
   }
   ```

2. **React Query Error Handling**:
   ```tsx
   const { data, isLoading, error } = useQuery({
     queryKey: ['connections'],
     queryFn: connectionsAPI.getMyConnections,
     onError: (error) => {
       toast.error(error.message || 'Failed to load connections');
     },
   });

   if (error) {
     return <ErrorState message={error.message} />;
   }
   ```

3. **Form Validation Errors**:
   ```tsx
   const { formState: { errors } } = useForm();

   {errors.email && (
     <span className="text-sm text-destructive">
       {errors.email.message}
     </span>
   )}
   ```

**Toast Notifications** (Sonner):
```tsx
import { toast } from 'sonner';

// Success
toast.success('Connection created successfully');

// Error
toast.error('Failed to create connection');

// Loading
const toastId = toast.loading('Creating connection...');
// Later: toast.dismiss(toastId);

// Promise (auto-handles loading/success/error)
toast.promise(
  connectionsAPI.createConnection(data),
  {
    loading: 'Creating connection...',
    success: 'Connection created!',
    error: 'Failed to create connection',
  }
);
```

**Toaster Configuration** (`src/app/layout.tsx`):
```tsx
import { Toaster } from 'sonner';

<Toaster position="bottom-right" />
```

### 10. Code Quality & Best Practices

**Linting & Type Checking**:

```bash
# Run ESLint
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Type check without emitting files
npm run type-check

# Pre-commit validation (ESLint + TypeScript)
npm run validate
```

**Lefthook Pre-commit Hooks** (auto-installed on `npm install`):
- Runs `npm run lint` before commits
- Runs `npm run type-check` before commits
- Prevents commits with linting/type errors

**Code Formatting Conventions**:

1. **Imports Organization**:
   ```tsx
   // 1. React and Next.js
   import { useState, useEffect } from 'react';
   import { useRouter } from 'next/navigation';

   // 2. Third-party libraries
   import { useForm } from 'react-hook-form';
   import { zodResolver } from '@hookform/resolvers/zod';
   import { toast } from 'sonner';

   // 3. Internal components (absolute imports with @/)
   import { Button } from '@/components/ui/button';
   import { Input } from '@/components/ui/input';

   // 4. Internal utilities and hooks
   import { cn } from '@/utils/ui';
   import { useAuth } from '@/features/auth/hooks/useAuth';

   // 5. Types
   import type { User } from '@/types/user';
   ```

2. **Component Structure**:
   ```tsx
   'use client';  // Only if client component

   import { ... };

   // Types/Interfaces
   interface ComponentProps {
     title: string;
     onAction: () => void;
   }

   // Main component
   export function ComponentName({ title, onAction }: ComponentProps) {
     // 1. Hooks
     const router = useRouter();
     const [state, setState] = useState(false);

     // 2. Derived state
     const isActive = state && title.length > 0;

     // 3. Effects
     useEffect(() => {
       // ...
     }, []);

     // 4. Event handlers
     const handleClick = () => {
       // ...
     };

     // 5. Early returns (loading, error states)
     if (!title) return null;

     // 6. Render
     return (
       <div className={cn('base-classes', isActive && 'active-classes')}>
         {/* JSX */}
       </div>
     );
   }
   ```

3. **Naming Conventions**:
   - **Components**: PascalCase (`UserProfile`, `ConnectionModal`)
   - **Functions/Variables**: camelCase (`handleSubmit`, `isLoading`)
   - **Constants**: UPPER_SNAKE_CASE (`API_URL`, `MAX_RETRIES`)
   - **Files**:
     - Components: PascalCase (`ConnectionModal.tsx`)
     - Utilities: camelCase (`route-utils.ts`)
     - Types: camelCase (`user.ts`, `connection.ts`)
   - **Event Handlers**: `handle` prefix (`handleClick`, `handleSubmit`)
   - **Boolean Variables**: `is`, `has`, `should` prefix (`isLoading`, `hasError`, `shouldRender`)

4. **Comment Guidelines**:
   - Use TSDoc for functions/types that need documentation
   - Avoid obvious comments (code should be self-documenting)
   - Comment "why" not "what"
   ```tsx
   // ✅ Good
   // Retry with exponential backoff to handle rate limits
   await retryWithBackoff(apiCall);

   // ❌ Bad
   // Call the API
   await apiCall();
   ```

### 11. Environment Variables

**Required Environment Variables** (`.env.example`):
```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# OAuth Configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id

# AI Configuration
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_ANTHROPIC_API_KEY=your_anthropic_api_key  # Optional

# App Configuration
NEXT_PUBLIC_APP_NAME=DB Explorer

# MCP Server (Optional)
NEXT_PUBLIC_MCP_SERVER_URL=http://localhost:3001
```

**Accessing Environment Variables**:
```tsx
// Client-side (must have NEXT_PUBLIC_ prefix)
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

// Server-side (no prefix needed)
const secretKey = process.env.SECRET_KEY;
```

### 12. Testing (Not Yet Implemented)

**Recommended Setup** (for future implementation):
- **Unit Tests**: Vitest (faster than Jest for Next.js)
- **Component Tests**: React Testing Library
- **E2E Tests**: Playwright
- **Type Checking**: TypeScript (already configured)

## Common Workflows

### Adding a New Feature

1. **Create Feature Folder** (if new domain):
   ```bash
   mkdir -p src/features/feature-name/{components,hooks,types,validations}
   ```

2. **Define Types** (`src/features/feature-name/types/index.ts`):
   ```tsx
   export interface FeatureData {
     id: string;
     name: string;
   }
   ```

3. **Create Validation Schema** (`src/features/feature-name/validations/index.ts`):
   ```tsx
   import { z } from 'zod';

   export const featureSchema = z.object({
     name: z.string().min(1),
   });

   export type FeatureFormData = z.infer<typeof featureSchema>;
   ```

4. **Create API Client** (`src/lib/api/feature.ts`):
   ```tsx
   import api from './axios';

   export const featureAPI = {
     getAll: async () => {
       const response = await api.get('/api/features');
       return response.data;
     },
     create: async (data: FeatureFormData) => {
       const response = await api.post('/api/features', data);
       return response.data;
     },
   };
   ```

5. **Create Components** (`src/features/feature-name/components/`):
   ```tsx
   'use client';

   import { useForm } from 'react-hook-form';
   import { zodResolver } from '@hookform/resolvers/zod';
   import { featureSchema, type FeatureFormData } from '../validations';

   export function FeatureForm() {
     const { register, handleSubmit, formState: { errors } } = useForm<FeatureFormData>({
       resolver: zodResolver(featureSchema),
     });

     const onSubmit = async (data: FeatureFormData) => {
       await featureAPI.create(data);
     };

     return (
       <form onSubmit={handleSubmit(onSubmit)}>
         {/* Form fields */}
       </form>
     );
   }
   ```

6. **Add Route** (`src/app/(private)/feature-name/page.tsx`):
   ```tsx
   import { FeatureForm } from '@/features/feature-name/components/FeatureForm';

   export default function FeaturePage() {
     return (
       <div>
         <h1>Feature Name</h1>
         <FeatureForm />
       </div>
     );
   }
   ```

### Adding a New Component

1. **Use shadcn/ui if possible**:
   ```bash
   # Install shadcn component
   npx shadcn-ui@latest add [component-name]
   ```

2. **Create custom component** (`src/components/domain/ComponentName.tsx`):
   ```tsx
   'use client';

   import { cn } from '@/utils/ui';

   interface ComponentNameProps {
     className?: string;
     children: React.ReactNode;
   }

   export function ComponentName({ className, children }: ComponentNameProps) {
     return (
       <div className={cn('base-classes', className)}>
         {children}
       </div>
     );
   }
   ```

3. **Export from index** (if needed for cleaner imports):
   ```tsx
   // src/components/domain/index.ts
   export { ComponentName } from './ComponentName';
   ```

### Debugging Tips

**React Query DevTools**:
```tsx
// Already enabled in QueryProvider.tsx
// Access via browser: Look for React Query icon in bottom-right
```

**Zustand DevTools**:
```tsx
// Already enabled in stores (via devtools middleware)
// Access via Redux DevTools browser extension
```

**Network Debugging**:
- Check Network tab in DevTools
- All API calls go through Axios instance
- Look for Authorization header in requests
- 401 errors trigger automatic token refresh

**Common Issues**:

1. **"window is not defined"** error:
   - Use `typeof window !== 'undefined'` checks
   - Or mark component as client component (`'use client'`)

2. **Dark mode not working**:
   - Ensure using semantic color tokens
   - Check `dark:` variants are applied
   - Verify ThemeProvider is in layout

3. **Form validation not working**:
   - Check zodResolver is imported from `@hookform/resolvers/zod`
   - Verify schema is correctly defined
   - Ensure field names match schema keys

4. **API calls failing**:
   - Check NEXT_PUBLIC_API_URL in `.env`
   - Verify access_token in localStorage
   - Check Network tab for error details

## Performance Optimization

**Next.js 15 Features**:
- **Turbopack**: Fast development bundling (enabled by default)
- **Server Components**: Reduced client-side JavaScript
- **Streaming**: Gradual page rendering
- **Image Optimization**: Automatic via `next/image`

**Optimization Techniques**:

1. **Dynamic Imports**:
   ```tsx
   import dynamic from 'next/dynamic';

   const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
     loading: () => <LoadingSpinner />,
   });
   ```

2. **React Query Caching**:
   ```tsx
   // Configured in QueryProvider
   staleTime: 60 * 1000,     // Don't refetch for 1 minute
   gcTime: 10 * 60 * 1000,   // Cache for 10 minutes
   ```

3. **Memoization**:
   ```tsx
   import { useMemo, useCallback } from 'react';

   const expensiveValue = useMemo(() => computeExpensiveValue(a, b), [a, b]);
   const memoizedCallback = useCallback(() => doSomething(a, b), [a, b]);
   ```

4. **Image Optimization**:
   ```tsx
   import Image from 'next/image';

   <Image
     src="/path/to/image.jpg"
     alt="Description"
     width={500}
     height={300}
     priority  // For above-the-fold images
   />
   ```

## Security Best Practices

1. **Never commit secrets** to version control
2. **Use environment variables** for all sensitive data
3. **Validate user input** with Zod schemas
4. **Sanitize HTML** in markdown rendering (uses `rehype-raw` with caution)
5. **CSRF protection** handled by Next.js
6. **JWT tokens** stored in localStorage (with automatic refresh)
7. **SQL injection prevention** via parameterized queries on backend

## Deployment

**Production Build**:
```bash
# Build
npm run build

# Start production server
npm start
```

**Environment Variables for Production**:
- Set all `NEXT_PUBLIC_*` variables
- Configure API_URL to production backend
- Add OAuth client IDs for production domain
- Set Gemini API key

**Vercel Deployment** (Recommended):
1. Connect GitHub repository
2. Configure environment variables in Vercel dashboard
3. Auto-deploys on push to main branch

## Additional Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Tailwind CSS 4 Docs**: https://tailwindcss.com/docs
- **shadcn/ui Docs**: https://ui.shadcn.com
- **Vercel AI SDK Docs**: https://sdk.vercel.ai/docs
- **React Hook Form Docs**: https://react-hook-form.com
- **Zod Docs**: https://zod.dev
- **Dark Mode Guide**: See `DARK_MODE.md` in this directory

## Contributing Guidelines

1. **Follow existing patterns** in the codebase
2. **Use semantic color tokens** (never hardcode colors)
3. **Validate forms** with Zod + React Hook Form
4. **Type everything** with TypeScript
5. **Test in both light and dark mode**
6. **Run validation before commits**: `npm run validate`
7. **Write descriptive commit messages**
8. **Keep components focused and small** (single responsibility)
9. **Document complex logic** with comments
10. **Update this CLAUDE.md** when introducing new patterns

---

**Last Updated**: 2025-01-28
**Version**: 1.0.0

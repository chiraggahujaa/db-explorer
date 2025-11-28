# DB Explorer Web - Development Guide

## Tech Stack
- **Framework**: Next.js 15.5.2 (App Router, Turbopack)
- **Language**: TypeScript 5.9 (strict mode)
- **Styling**: Tailwind CSS 4 (OKLch colors)
- **UI**: shadcn/ui (Radix UI primitives)
- **State**: Zustand 5 + React Query 5
- **Forms**: React Hook Form 7 + Zod 4
- **AI**: Vercel AI SDK v5 + Gemini 2.5 Flash (42 DB tools)
- **Auth**: JWT with auto-refresh
- **Icons**: Lucide React
- **Toasts**: Sonner

## Quick Start

```bash
npm install
cp .env.example .env
# Configure: NEXT_PUBLIC_API_URL, NEXT_PUBLIC_GOOGLE_CLIENT_ID, NEXT_PUBLIC_GEMINI_API_KEY

npm run dev              # Development
npm run build && npm start  # Production
npm run type-check       # Type checking
npm run lint             # Linting
npm run validate         # Pre-commit check
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth routes (/signin, /signup)
│   ├── (private)/         # Protected routes (/dashboard, /profile)
│   ├── (public)/          # Public routes (/)
│   ├── api/chat/          # AI chat endpoint (42 DB tools)
│   ├── layout.tsx         # Root layout with providers
│   └── globals.css        # Tailwind + dark mode CSS
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── layout/            # Header, navigation
│   ├── theme/             # ThemeToggle
│   ├── connections/       # Chat, Explorer, Modals
│   └── common/            # Shared components
├── features/              # Feature modules by domain
│   ├── auth/              # Auth components, hooks, validations
│   ├── profile/
│   └── onboarding/
├── lib/
│   ├── api/               # API clients (axios, auth, connections, chat, users)
│   ├── prompts/           # AI system prompts
│   └── utils/             # Route protection, UI utilities
├── stores/                # Zustand stores
│   ├── useAppStore.ts     # User & auth state
│   └── useChatStore.ts    # Chat sessions
├── providers/             # React Query, Theme providers
├── contexts/              # React contexts
├── types/                 # TypeScript types
├── utils/                 # Helpers (SQL, context, parsing)
└── hooks/                 # Custom hooks
```

## Key Patterns

### Routes
- **(auth)**: `/signin`, `/signup`, `/reset-password` (public)
- **(private)**: `/dashboard`, `/profile`, `/onboarding` (auth required)
- **(public)**: `/`, `/email-confirmation`
- **Dynamic**: `/dashboard/connections/[id]`, `/profile/[id]`
- **Protection**: `RootAuthGuard` handles redirects

### Components
- **Server Components** (default): Static content, data fetching
- **Client Components** (`"use client"`): Interactivity, hooks, browser APIs
- **Naming**: PascalCase, descriptive (`ConnectionModal`, `ExplorerSidebar`)

### Reusable Components
```tsx
// SearchableSelect - Combobox with search
<SearchableSelect options={[]} value="" onValueChange={fn} />

// SearchInput - Input with icon support
<SearchInput placeholder="Search..." icon={<Icon />} />

// ThemeToggle - Dark mode switcher
<ThemeToggle />
```

### State Management

**Zustand** (Global State):
```tsx
// useAppStore - User & auth
const { user, setUser, logout, setTokens } = useAppStore();

// useChatStore - Chat sessions
const { currentChatSessionId, createNewChat, loadChatHistory } = useChatStore();
```

**React Query** (Server State):
```tsx
const { data, isLoading } = useQuery({
  queryKey: ['connections'],
  queryFn: () => connectionsAPI.getMyConnections(),
});
```

**Context** (Component-specific):
```tsx
const { selectedSchema, toggleTable } = useConnectionExplorer();
```

### TypeScript
- **Types location**: Domain types in `src/types/`, feature types in feature folders
- **Naming**: Interfaces/Types = PascalCase (no "I" prefix)
- **Patterns**: Discriminated unions, utility types, Zod inference
```tsx
type DatabaseType = 'mysql' | 'postgresql' | 'sqlite' | 'supabase';
export type LoginFormData = z.infer<typeof loginSchema>;
```

### Styling (CRITICAL)

**ALWAYS use semantic tokens** (never hardcode colors):
```tsx
// ✅ GOOD
<div className="bg-background text-foreground border-border" />
<Button className="bg-primary text-primary-foreground" />

// ❌ BAD (breaks dark mode)
<div className="bg-white text-black border-gray-200" />
```

**Semantic tokens**: `background`, `foreground`, `card`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`

**Utilities**:
```tsx
import { cn } from '@/utils/ui';
<div className={cn('px-4', isActive && 'bg-primary', className)} />
```

**Dark mode**: Uses `next-themes`, automatic localStorage persistence. See `DARK_MODE.md`.

### Forms (React Hook Form + Zod)

```tsx
// 1. Define schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
type LoginFormData = z.infer<typeof loginSchema>;

// 2. Use in component
const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
  resolver: zodResolver(loginSchema),
});

// 3. Render
<Input {...register('email')} />
{errors.email && <span className="text-sm text-destructive">{errors.email.message}</span>}
```

### API Integration

**Axios** (`src/lib/api/axios.ts`):
- Auto-adds Bearer token to requests
- Auto-refreshes token on 401
- Timeout: 10s

**API Clients** (domain-based in `src/lib/api/`):
```tsx
// auth.ts
authAPI.login(email, password)
authAPI.register(name, email, password)
authAPI.getProfile()

// connections.ts
connectionsAPI.getMyConnections()
connectionsAPI.createConnection(data)

// chatSessions.ts
chatSessionsAPI.createSession(data)
```

### AI Integration (Vercel AI SDK)

**Server** (`src/app/api/chat/route.ts`):
- 42 database tools (select, insert, update, delete, join, analyze, etc.)
- Gemini 2.5 Flash model
- Streaming responses
- Max 10 tool execution steps

**Client** (`src/components/connections/ChatInterfaceNew.tsx`):
```tsx
const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
  api: '/api/chat',
  body: { connectionId, userId, selectedSchema, chatConfig },
  onFinish: (message) => saveChatMessages(input, message.content),
});
```

**42 Database Tools**:
- Schema: list_databases, list_tables, describe_table, show_indexes
- Query: select_data, count_records, search_records, execute_custom_query
- Modify: insert_record, update_record, delete_record, bulk_insert
- Analysis: join_tables, validate_referential_integrity, get_column_statistics
- Tenant: list_tenants, switch_tenant_context, compare_tenant_data

### Error Handling

```tsx
// Toast notifications
import { toast } from 'sonner';
toast.success('Success message');
toast.error('Error message');
toast.promise(apiCall, { loading: '...', success: '...', error: '...' });

// React Query
onError: (error) => toast.error(error.message)

// Forms
{errors.field && <span className="text-sm text-destructive">{errors.field.message}</span>}
```

## Code Conventions

**Imports**:
```tsx
// 1. React/Next.js
// 2. Third-party
// 3. Internal components (@/)
// 4. Internal utils/hooks
// 5. Types
```

**Naming**:
- Components: PascalCase (`UserProfile`)
- Functions/Variables: camelCase (`handleSubmit`, `isLoading`)
- Constants: UPPER_SNAKE_CASE (`API_URL`)
- Event handlers: `handle` prefix (`handleClick`)
- Booleans: `is`, `has`, `should` prefix

**Component Structure**:
```tsx
'use client';  // Only if needed
// 1. Hooks
// 2. Derived state
// 3. Effects
// 4. Event handlers
// 5. Early returns
// 6. Render
```

## Environment Variables

```bash
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
NEXT_PUBLIC_GEMINI_API_KEY=...
NEXT_PUBLIC_ANTHROPIC_API_KEY=...  # Optional
NEXT_PUBLIC_APP_NAME=DB Explorer
```

## Workflows

### Add Feature
1. Create folder: `src/features/feature-name/{components,hooks,types,validations}`
2. Define types + Zod schema
3. Create API client in `src/lib/api/`
4. Build components with React Hook Form + Zod
5. Add route in `src/app/(private)/`

### Add Component
1. Use shadcn/ui if possible: `npx shadcn-ui@latest add [component]`
2. Or create custom in `src/components/domain/`
3. Use `cn()` for class merging, semantic tokens for colors

## Debugging

- **React Query DevTools**: Bottom-right icon in browser
- **Zustand DevTools**: Redux DevTools extension
- **Network**: Check Authorization header, 401s auto-refresh token

**Common Issues**:
- "window is not defined": Use client component or `typeof window !== 'undefined'`
- Dark mode broken: Use semantic tokens, check ThemeProvider
- Forms not validating: Check zodResolver, schema, field names match
- API failing: Check .env, token in localStorage, Network tab

## Performance

- **Dynamic imports**: `const Component = dynamic(() => import('./Component'))`
- **React Query cache**: staleTime: 60s, gcTime: 10min
- **Memoization**: `useMemo`, `useCallback`
- **Images**: Use `next/image` with priority for above-fold

## Security

- Never commit secrets
- Use environment variables
- Validate all input with Zod
- JWT in localStorage with auto-refresh
- Parameterized queries on backend

## Deployment

```bash
npm run build && npm start
```

**Vercel** (recommended):
1. Connect GitHub repo
2. Set environment variables in dashboard
3. Auto-deploy on push to main

## Contributing

1. Use semantic color tokens (never hardcode)
2. Validate forms with Zod + React Hook Form
3. Type everything with TypeScript
4. Test in light + dark mode
5. Run `npm run validate` before commits
6. Keep components small, single responsibility
7. Comment "why" not "what"
8. Update CLAUDE.md for new patterns

---

**Version**: 1.0.0 | **Last Updated**: 2025-01-28

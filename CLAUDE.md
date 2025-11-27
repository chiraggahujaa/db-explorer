# DB Explorer - Project Instructions

## Project Overview
DB Explorer is a modern database exploration and management platform with user authentication, management features, and AI-powered natural language database queries using Vercel AI SDK.

For web application setup and development, see: [db-explorer-web/CLAUDE.md](./db-explorer-web/CLAUDE.md)
For API server setup and development, see: [db-explorer-api/CLAUDE.md](./db-explorer-api/CLAUDE.md)

## Quick Start

### Web Application
```bash
cd db-explorer-web
npm install
npm run dev
```

### API Server
```bash
cd db-explorer-api
npm install
cp .env.example .env
# Configure your Supabase credentials in .env
npm run dev
```

## Tech Stack
- **Frontend**: Next.js 15+ with App Router, Tailwind CSS 4, shadcn/ui
- **Backend**: Node.js + Express + TypeScript
- **AI Integration**: Vercel AI SDK with Gemini 2.5 Flash
- **Database**: Supabase (PostgreSQL) + Multi-database support (MySQL, PostgreSQL, SQLite, Supabase)
- **Auth**: JWT-based with Google OAuth support
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod
- **Chat Access**: AI-powered natural language database queries with 42+ database tools

## Dark Mode

The application includes a comprehensive dark mode implementation with automatic browser storage persistence.

- **Documentation**: See [db-explorer-web/DARK_MODE.md](./db-explorer-web/DARK_MODE.md) for complete implementation details
- **Toggle Component**: Available in the header (`ThemeToggle`)
- **Usage**: All components support `dark:` variants using semantic color tokens
- **Persistence**: Theme preferences automatically saved to localStorage
- **System Preference**: Respects OS dark mode setting

## Reusable Components

The project includes reusable UI components that should be used throughout the application:

- **SearchableSelect** (`db-explorer-web/src/components/ui/searchable-select.tsx`): A searchable combobox for selecting from lists with search functionality. Use for dropdowns that need search (e.g., schema selection, connection selection).

- **SearchInput** (`db-explorer-web/src/components/ui/search-input.tsx`): A search input component with optional icon support. Use for text search/filter inputs (e.g., table filtering, record searching).

- **ThemeToggle** (`db-explorer-web/src/components/theme/ThemeToggle.tsx`): A theme switcher component for light/dark/system modes. Located in the header for easy access.

See `db-explorer-web/CLAUDE.md` for detailed usage examples and API documentation.

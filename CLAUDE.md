# DB Explorer - Project Instructions

## Project Overview
DB Explorer is a modern database exploration and management platform with user authentication, management features, and chat-based database access through an MCP (Model Context Protocol) server.

For web application setup and development, see: [db-explorer-web/CLAUDE.md](./db-explorer-web/CLAUDE.md)
For API server setup and development, see: [db-explorer-api/CLAUDE.md](./db-explorer-api/CLAUDE.md)
For MCP server setup and development, see: [db-mcp/README.md](./db-mcp/README.md) and [db-mcp/CLAUDE.md](./db-mcp/CLAUDE.md)

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

### MCP Server
```bash
cd db-mcp
bun install
cp .env.example .env
# Configure your database connections in .env
bun run start
```

## Tech Stack
- **Frontend**: Next.js 15+ with App Router, Tailwind CSS 4, shadcn/ui
- **Backend**: Node.js + Express + TypeScript
- **MCP Server**: Bun + Model Context Protocol
- **Database**: Supabase (PostgreSQL) + Multi-database support (MySQL, PostgreSQL, SQLite, Supabase)
- **Auth**: JWT-based with Google OAuth support
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod
- **Chat Access**: MCP server for natural language database queries

## Reusable Components

The project includes reusable UI components that should be used throughout the application:

- **SearchableSelect** (`db-explorer-web/src/components/ui/searchable-select.tsx`): A searchable combobox for selecting from lists with search functionality. Use for dropdowns that need search (e.g., schema selection, connection selection).

- **SearchInput** (`db-explorer-web/src/components/ui/search-input.tsx`): A search input component with optional icon support. Use for text search/filter inputs (e.g., table filtering, record searching).

See `db-explorer-web/CLAUDE.md` for detailed usage examples and API documentation.

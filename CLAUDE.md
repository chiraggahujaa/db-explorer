# DB Explorer 2 - Project Instructions

## Project Overview
DB Explorer 2 is a modern database exploration and management platform with user authentication, management features, and chat-based database access through an MCP (Model Context Protocol) server.

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

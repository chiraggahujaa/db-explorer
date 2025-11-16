# DB Explorer - AI-Powered Database Management

A modern database exploration tool with natural language queries, real-time streaming, and intelligent permissions.

## 🌟 Features

- 🤖 **Natural Language Queries** - Ask questions in plain English
- 🤖 **Multiple AI Providers** - Choose between Gemini (10x cheaper) or Claude
- ⚡ **Real-Time Streaming** - See AI responses as they arrive
- 🔒 **Smart Permissions** - Protection for sensitive operations  
- 🎨 **Modern UI** - Clean, professional interface
- 🔌 **Direct MCP Connection** - Efficient SSE-based communication
- 🚀 **Dynamic Connections** - Configure databases on-the-fly
- 📊 **40+ Database Tools** - Query, modify, and analyze data

## 🏗️ Architecture

```
Frontend (React) ━━━ SSE ━━━ MCP Server (Bun) ━━━ Database
                                      ↑
Backend (Express) ━━━━━━━━━━━━━━━━━━━┘
  (Auth & Connections)
```

## 🚀 Quick Start

### Prerequisites
- **Bun**: `curl -fsSL https://bun.sh/install | bash`
- **Node.js 18+**
- **Database** (PostgreSQL, MySQL, SQLite, etc.)

### Installation

```bash
# 1. Start MCP Server
cd db-mcp
bun install
bun run dev          # http://localhost:3002

# 2. Start Backend API
cd db-explorer-api
npm install
npm run dev          # http://localhost:5000

# 3. Start Frontend
cd db-explorer-web
npm install
npm run dev          # http://localhost:3000
```

## 📝 Configuration

### MCP Server (.env)
```bash
MCP_SERVER_PORT=3002
MAX_QUERY_RESULTS=1000
ALLOW_DATA_MODIFICATION=true
ALLOW_DROP=false
READ_ONLY_MODE=false
LOG_LEVEL=info
```

### Backend (.env)
```bash
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
JWT_SECRET=your-jwt-secret
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env.local)
```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_MCP_SERVER_URL=http://localhost:3002

# AI Provider (recommended: gemini)
NEXT_PUBLIC_AI_PROVIDER=gemini  # or 'claude'

# Google Gemini API Key
# Get from: https://aistudio.google.com/app/apikey
NEXT_PUBLIC_GEMINI_API_KEY=your-gemini-api-key

# Anthropic Claude API Key (Optional)
# Get from: https://console.anthropic.com/
# NEXT_PUBLIC_ANTHROPIC_API_KEY=your-anthropic-key

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

## 💬 Usage Examples

**Natural Language:**
```
Show me all users created in the last 7 days
Find customers with orders over $1000
```

**SQL Queries:**
```sql
SELECT * FROM orders WHERE total > 1000 LIMIT 10
```

**Direct Tool Calls:**
```
/list_tables
/describe_table {"table": "users"}
```

## 🔒 Security Features

- **Permission System**: Automatic prompts for DELETE, sensitive tables, large queries
- **Configurable Protection**: Read-only mode, query limits, DROP/TRUNCATE guards
- **Smart Caching**: "Always Allow" option for trusted operations

## 📊 Available Tools

- **Schema**: `list_databases`, `list_tables`, `describe_table`, `show_indexes`
- **Query**: `select_data`, `count_records`, `search_records`, `execute_custom_query`
- **Modify**: `insert_record`, `update_record`, `delete_record`, `bulk_insert`
- **Analysis**: `join_tables`, `find_orphaned_records`, `analyze_table_relationships`
- **Utility**: `explain_query`, `check_table_status`, `optimize_table`, `test_connection`

## 🔧 Tech Stack

- **Frontend**: Next.js 15, React 19, TailwindCSS, Zustand, MCP SDK
- **Backend**: Express 5, Supabase, JWT
- **MCP Server**: Bun, Zod, Model Context Protocol
- **Databases**: MySQL, PostgreSQL, SQLite, MongoDB, Supabase

## 🐛 Troubleshooting

**MCP Server Won't Start:**
```bash
# Check port availability
lsof -i :3002

# Try different port
MCP_SERVER_PORT=3003 bun run dev
```

**Frontend Connection Issues:**
1. Verify MCP server is running: `curl http://localhost:3002/sse`
2. Check `NEXT_PUBLIC_MCP_SERVER_URL` in frontend `.env.local`
3. Review browser console for errors

**AI API Errors:**
1. **For Gemini**: Get API key from https://aistudio.google.com/app/apikey
2. **For Claude**: Get API key from https://console.anthropic.com/
3. Set the appropriate environment variable in frontend `.env.local`
4. Restart your development server

## 📚 Documentation

- [MCP Server Guide](./db-mcp/README.md) - Tools and configuration
- [API Documentation](./db-explorer-api/README.md) - Backend endpoints

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - See LICENSE file for details


---

**Made with ❤️ for database developers**

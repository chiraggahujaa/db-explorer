# DB Explorer - AI-Powered Database Management

A modern database exploration tool with natural language queries powered by Vercel AI SDK and Google Gemini 2.5 Flash.

## 🌟 Features

- 🤖 **Natural Language Queries** - Ask questions in plain English using Gemini 2.5 Flash
- ⚡ **Real-Time Streaming** - See AI responses as they arrive with Vercel AI SDK
- 🔒 **Smart Context Management** - Automatic context summarization for long conversations
- 🎨 **Modern UI** - Clean, professional interface with dark mode
- 🚀 **Dynamic Connections** - Configure databases on-the-fly
- 📊 **42+ Database Tools** - Query, modify, and analyze data with AI-powered tools
- 💾 **Schema Pre-training** - Train AI on your database schema for better queries
- 🎯 **Context Caching** - Gemini 2.5 Flash's implicit caching for 75% cost reduction

## 🏗️ Architecture

```
Frontend (Next.js) ━━━ API Route (/api/chat) ━━━ Gemini 2.5 Flash
                              ↓
Backend (Express) ━━━ Database Tools ━━━ Multi-DB Support
  (Auth & Connections)
```

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+**
- **Database** (PostgreSQL, MySQL, SQLite, or Supabase)
- **Gemini API Key** (Get from [Google AI Studio](https://aistudio.google.com/app/apikey))

### Installation

```bash
# 1. Start Backend API
cd db-explorer-api
npm install
cp .env.example .env
# Configure your Supabase credentials in .env
npm run dev          # http://localhost:5000

# 2. Start Frontend
cd db-explorer-web
npm install
cp .env.example .env.local
# Add your Gemini API key to .env.local
npm run dev          # http://localhost:3000
```

## 📝 Configuration

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

# Google Gemini API Key (Required)
# Get from: https://aistudio.google.com/app/apikey
NEXT_PUBLIC_GEMINI_API_KEY=your-gemini-api-key

# Google OAuth (Optional)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

## 💬 Usage Examples

**Natural Language:**
```
Show me all users created in the last 7 days
Find customers with orders over $1000
What are the foreign key relationships in this database?
```

**SQL Queries:**
```sql
SELECT * FROM orders WHERE total > 1000 LIMIT 10
```

**Schema Exploration:**
```
Show me all tables in this database
Describe the users table structure
```

## 🔒 Security Features

- **JWT Authentication**: Secure user authentication and authorization
- **Role-Based Access**: Owner, admin, and viewer roles for connections
- **Query Validation**: AI-powered query safety checks
- **Configurable Protection**: Read-only mode, query limits

## 📊 Available AI Tools (42+)

### Schema & Structure
- `list_databases`, `list_tables`, `describe_table`, `show_indexes`
- `analyze_foreign_keys`, `get_table_dependencies`

### Data Query
- `select_data`, `count_records`, `find_by_id`, `search_records`
- `get_recent_records`, `execute_custom_query`

### Data Modification
- `insert_record`, `update_record`, `delete_record`, `bulk_insert`

### Analysis & Relationships
- `join_tables`, `find_orphaned_records`, `validate_referential_integrity`
- `analyze_table_relationships`, `get_column_statistics`

### Utility & Maintenance
- `explain_query`, `check_table_status`, `optimize_table`
- `test_connection`, `get_database_size`

## 🔧 Tech Stack

- **Frontend**: Next.js 15, React 19, TailwindCSS, Zustand, Vercel AI SDK
- **Backend**: Express 5, Supabase, JWT, TypeScript
- **AI**: Gemini 2.5 Flash with 42+ database tools
- **Databases**: MySQL, PostgreSQL, SQLite, Supabase

## 🎯 Key Features

### Schema Pre-training
Train the AI on your database schema for more accurate queries:
1. Connect to your database
2. Click "Train Schema" button
3. AI learns your table structures, relationships, and constraints
4. Get better query suggestions and validations

### Context Management
- **Automatic Summarization**: Long conversations are automatically summarized
- **Context Window Tracking**: Visual indicator of context usage
- **Implicit Caching**: Gemini 2.5 Flash caches repeated content for cost savings

### Chat History
- **Persistent Sessions**: Resume conversations anytime
- **Title Generation**: AI generates meaningful titles for chats
- **Multi-Connection Support**: Separate chat histories per database

## 🐛 Troubleshooting

**Frontend Connection Issues:**
1. Verify backend is running: `curl http://localhost:5000/health`
2. Check `NEXT_PUBLIC_API_URL` in frontend `.env.local`
3. Review browser console for errors

**AI API Errors:**
1. Get Gemini API key from https://aistudio.google.com/app/apikey
2. Set `NEXT_PUBLIC_GEMINI_API_KEY` in frontend `.env.local`
3. Restart your development server

**Database Connection Issues:**
1. Verify database credentials in backend `.env`
2. Check Supabase connection status
3. Test connection from the UI

## 📚 Documentation

- [Frontend Documentation](./db-explorer-web/CLAUDE.md) - Web app setup and development
- [Backend Documentation](./db-explorer-api/CLAUDE.md) - API server setup and development

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - See LICENSE file for details

---

**Made with ❤️ for database developers using Vercel AI SDK**

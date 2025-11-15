# Multi-Database MCP Server

A Bun-powered Model Context Protocol (MCP) server with support for MySQL, PostgreSQL, SQLite, MongoDB, and Supabase. Features dynamic connection management, intelligent permissions, and 40+ database tools.

## 🌟 Features

### Database Support
- **MySQL/MariaDB**: Full SQL support with connection pooling
- **PostgreSQL**: Native support with JSON/JSONB
- **SQLite**: File-based and in-memory databases
- **MongoDB**: Document database support
- **Supabase**: PostgreSQL with real-time capabilities

### Key Capabilities
- **Dynamic Connections**: Configure databases on-the-fly from frontend
- **Smart Permissions**: Automatic prompts for sensitive operations
- **Security**: SQL injection detection, rate limiting, audit logging
- **Fault Tolerance**: Auto-retry, health monitoring, graceful degradation
- **Structured Logging**: Beautiful, informative console output

## 🚀 Quick Start

### Prerequisites
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Verify installation
bun --version
```

### Installation
```bash
# Install dependencies
bun install

# Start server
bun run dev
```

Server starts on `http://localhost:3002`

## 📝 Configuration

### Environment Variables (.env)
```bash
# Server Configuration
MCP_SERVER_PORT=3002
NODE_ENV=development
LOG_LEVEL=info

# Query Settings
MAX_QUERY_RESULTS=1000
QUERY_TIMEOUT_MS=30000

# Security Settings
READ_ONLY_MODE=false
ALLOW_DATA_MODIFICATION=true
ALLOW_DROP=false
ALLOW_TRUNCATE=false
```

### Dynamic Connection Management

**Note**: This server uses **dynamic connections** configured from the frontend. Static environment-based connections are not supported.

Connections are configured via the `configure_connection` tool:
```javascript
{
  "connectionId": "conn-123",
  "config": {
    "type": "mysql",
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "password",
    "database": "mydb"
  }
}
```

## 🛠️ Available Tools (40+)

### Schema & Structure
- `list_databases` - List all available databases
- `list_tables` - List tables in a database
- `describe_table` - Get detailed table schema
- `show_indexes` - Show table indexes
- `analyze_foreign_keys` - Analyze foreign key relationships
- `get_table_dependencies` - Get table dependency tree

### Data Query
- `select_data` - Execute SELECT with advanced filtering
- `count_records` - Count records with conditions
- `find_by_id` - Find records by ID or primary key
- `search_records` - Full-text search across columns
- `get_recent_records` - Get recently created/modified records
- `execute_custom_query` - Execute custom SQL safely

### Data Modification (with permissions)
- `insert_record` - Insert single record
- `update_record` - Update records with WHERE conditions
- `delete_record` - Delete records with safety checks
- `bulk_insert` - Insert multiple records efficiently

### Analysis & Relationships
- `join_tables` - Execute JOIN queries across tables
- `find_orphaned_records` - Find records without valid foreign keys
- `validate_referential_integrity` - Check constraint violations
- `analyze_table_relationships` - Map table relationships
- `get_column_statistics` - Get statistical information

### Tenant Management
- `list_tenants` - List all tenant databases
- `switch_tenant_context` - Switch active tenant database
- `get_tenant_schema` - Get complete tenant schema
- `compare_tenant_data` - Compare data across tenants
- `get_tenant_tables` - Get tables and counts for tenant

### Utility & Maintenance
- `explain_query` - Get query execution plan
- `check_table_status` - Get table status (size, rows, engine)
- `optimize_table` - Optimize table for performance
- `backup_table_structure` - Export table DDL
- `test_connection` - Test database health
- `show_connections` - Show available connections
- `get_database_size` - Get database size and storage

### Configuration
- `configure_connection` - Configure database connection dynamically

## 🔒 Security Features

### Permission System
Automatic permission prompts for:
- DELETE operations (always)
- Sensitive tables (users, passwords, auth, sessions)
- Large queries (>1000 rows)
- Schema modifications (DROP, TRUNCATE, ALTER)

### Security Policies
- SQL injection detection
- Query validation and sanitization
- Rate limiting per connection
- Configurable read-only mode
- Audit logging for all operations

## 📊 Usage Examples

### Query Data
```javascript
// List all tables
await callTool('list_tables', {})

// Describe table structure
await callTool('describe_table', { table: 'users' })

// Select with filtering
await callTool('select_data', {
  table: 'orders',
  columns: ['id', 'total', 'created_at'],
  where: 'total > ?',
  params: [1000],
  limit: 50,
  orderBy: 'created_at DESC'
})
```

### Modify Data (with permissions)
```javascript
// Insert record
await callTool('insert_record', {
  table: 'products',
  data: {
    name: 'New Product',
    price: 99.99,
    stock: 100
  }
})

// Update with condition
await callTool('update_record', {
  table: 'users',
  data: { status: 'active' },
  where: 'last_login < ?',
  params: ['2024-01-01']
})
```

### Analysis
```javascript
// Join tables
await callTool('join_tables', {
  leftTable: 'orders',
  rightTable: 'customers',
  joinType: 'INNER',
  leftKey: 'customer_id',
  rightKey: 'id',
  columns: ['orders.*', 'customers.name']
})

// Get statistics
await callTool('get_column_statistics', {
  table: 'sales',
  column: 'amount'
})
```

## 🔧 Development

### Project Structure
```
db-mcp/
├── src/
│   ├── server-bun-sse.ts      # Main SSE server (Bun-compatible)
│   ├── database/               # Database managers & factories
│   ├── tools/                  # MCP tool handlers
│   │   ├── schema.ts          # Schema tools
│   │   ├── query.ts           # Query tools
│   │   ├── modify.ts          # Modification tools
│   │   ├── analysis.ts        # Analysis tools
│   │   ├── tenant.ts          # Tenant management
│   │   ├── utility.ts         # Utility tools
│   │   └── configure.ts       # Configuration tool
│   └── utils/                  # Utilities (logger, permissions)
├── package.json
└── tsconfig.json
```

### Adding New Tools

1. Create tool handler in `src/tools/`:
```typescript
export const myToolSchema = z.object({
  param1: z.string(),
  param2: z.number().optional(),
});

export async function myTool(args: z.infer<typeof myToolSchema>) {
  // Implement tool logic
  return { result: 'success' };
}
```

2. Register in `server-bun-sse.ts`:
```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'my_tool') {
    const result = await myTool(request.params.arguments);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
});
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Check what's using the port
lsof -i :3002

# Kill the process
kill -9 <PID>

# Or use different port
MCP_SERVER_PORT=3003 bun run dev
```

### Connection Issues
```bash
# Test SSE endpoint
curl -N http://localhost:3002/sse

# Check server logs
bun run dev  # Watch for error messages
```

### Permission Issues
- Check `ALLOW_DATA_MODIFICATION` in `.env`
- Verify security settings (ALLOW_DROP, ALLOW_TRUNCATE)
- Review permission logs in console output

## 📚 Resources

- [Model Context Protocol](https://modelcontextprotocol.io) - Official MCP documentation
- [Bun Runtime](https://bun.sh) - Fast JavaScript runtime
- [Project Repository](../README.md) - Main project documentation

## 📄 License

MIT License - See LICENSE file for details

---

**Built with Bun and Model Context Protocol**

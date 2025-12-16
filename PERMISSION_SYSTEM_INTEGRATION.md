# AI Tool Permission System - Integration Guide

## Overview

This document describes the comprehensive AI tool permission system that allows users to control which database tools the AI can access on a per-connection, per-user basis.

## Architecture

### Database Layer
- **Tables:**
  - `ai_tool_permissions`: Stores user permissions for tools/categories
  - `ai_tool_permission_requests`: Pending permission requests from AI
  - `ai_tool_audit_log`: Audit log of all tool executions

### Backend (API)
- **Tool Registry:** `/src/config/toolRegistry.ts`
  - Categorizes all 42 database tools
  - Defines risk levels and requirements
  - 6 main categories: Schema & Structure, Data Query, Data Modification, Analysis & Relationships, Tenant Management, Utility & Maintenance

- **Service Layer:** `/src/services/ToolPermissionService.ts`
  - Permission checking logic
  - CRUD operations for permissions
  - Audit logging

- **API Routes:** `/src/routes/toolPermissions.ts`
  - `GET /api/tool-permissions/registry` - Get tool catalog
  - `GET /api/tool-permissions/connections/:id` - Get user permissions
  - `POST /api/tool-permissions` - Create permission
  - `POST /api/tool-permissions/bulk-update` - Bulk update
  - `POST /api/tool-permissions/check` - Check if user has permission
  - `POST /api/tool-permissions/connections/:id/initialize` - Initialize defaults

### Frontend (Web)
- **UI Components:**
  - `ToolPermissionSettings.tsx` - Full permission management UI
  - `ToolPermissionDialog.tsx` - In-chat permission approval dialog

- **API Client:** `/src/lib/api/toolPermissions.ts`
  - React Query hooks for permission management

## Integration Steps

### 1. Run Database Migration

```bash
cd db-explorer-api
# Apply the migration
psql $DATABASE_URL -f supabase/migrations/20251216000001_create_tool_permissions.sql
```

### 2. Initialize Default Permissions

When a user creates or accesses a connection for the first time, call:

```typescript
await toolPermissionsApi.initializeDefaultPermissions(connectionId);
```

This enables default-allowed categories:
- Schema & Structure (all tools)
- Data Query (read-only access)
- Analysis & Relationships
- Tenant Management

### 3. Add Permission Settings to Connection Details

In your connection details or settings page, add:

```tsx
import { ToolPermissionSettings } from '@/components/connections/ToolPermissionSettings';

<ToolPermissionSettings connection={connection} />
```

### 4. Integrate Permission Checking in Chat API

In `/db-explorer-web/src/app/api/chat/route.ts`, wrap tool executions:

```typescript
import { checkToolPermission, ToolPermissionError } from '@/lib/toolPermissionHelper';

// Example for select_data tool
select_data: tool({
  description: 'Execute SELECT query...',
  inputSchema: z.object({...}),
  execute: async (input, options) => {
    // Check permission
    const permissionCheck = await checkToolPermission(
      'select_data',
      connectionId,
      userId,
      accessToken
    );

    if (!permissionCheck.granted) {
      if (permissionCheck.requiresApproval) {
        return {
          error: 'PERMISSION_REQUIRED',
          message: 'Permission required for select_data tool',
          toolName: 'select_data',
          requiresApproval: true,
        };
      } else {
        return {
          error: 'PERMISSION_DENIED',
          message: 'You have not granted permission to use this tool',
          toolName: 'select_data',
        };
      }
    }

    // Execute the tool
    const result = await executeDBQuery(...);
    return result.data || [];
  }
}),
```

### 5. Handle Permission Errors in Chat UI

In `ChatInterfaceNew.tsx`, handle permission errors from tool responses:

```typescript
const [permissionDialog, setPermissionDialog] = useState<{
  open: boolean;
  toolName: string;
  toolArgs?: any;
}>({ open: false, toolName: '' });

// When detecting PERMISSION_REQUIRED in tool response
if (toolCallResult.error === 'PERMISSION_REQUIRED') {
  setPermissionDialog({
    open: true,
    toolName: toolCallResult.toolName,
    toolArgs: toolCall.args,
  });
}

// Render the dialog
<ToolPermissionDialog
  open={permissionDialog.open}
  onOpenChange={(open) => setPermissionDialog({ ...permissionDialog, open })}
  toolName={permissionDialog.toolName}
  toolArgs={permissionDialog.toolArgs}
  onExecuteOnce={async () => {
    // Grant one-time permission and retry tool
    await handleToolRetry(permissionDialog.toolName);
  }}
  onExecuteAndRemember={async () => {
    // Save permission and retry
    await toolPermissionsApi.createPermission({
      connectionId: connection.id,
      scope: 'tool',
      toolName: permissionDialog.toolName,
      allowed: true,
      autoApprove: true,
    });
    await handleToolRetry(permissionDialog.toolName);
  }}
  onDeny={() => {
    // User denied permission
    toast.error('Tool permission denied');
  }}
/>
```

## Permission Flow

### Scenario 1: User Asks AI to Query Data

1. User: "Get me 5 latest orders"
2. AI attempts to use `select_data` tool
3. System checks if user has permission for `select_data`
4. **If granted:** Tool executes, returns data
5. **If not granted:**
   - Permission dialog appears
   - User chooses: Execute Once / Execute & Remember / Deny
   - If approved, tool executes
   - If "Remember" selected, permission saved to database

### Scenario 2: User Manages Permissions in Settings

1. User navigates to Connection Settings → Tool Permissions
2. Views all 42 tools organized by 6 categories
3. Can:
   - Enable/disable individual tools
   - Enable/disable entire categories
   - Set auto-approve for specific tools
   - View risk levels and destructive flags
   - Reset to defaults

### Scenario 3: Category-Level Permissions

1. User enables "Data Modification" category
2. All tools in that category (`insert_record`, `update_record`, `delete_record`, `bulk_insert`) become available
3. AI can use any of these tools without individual approval
4. User can still override specific tools within the category

## Permission Hierarchy

1. **Tool-specific permission** (highest priority)
   - If user has explicitly allowed/denied a specific tool, that takes precedence

2. **Category-level permission**
   - If no tool-specific permission exists, check category permission

3. **Default behavior**
   - Tools with `requiresPermission: false` always allowed
   - All other tools denied by default

## Security Features

### Risk Levels
- **Low Risk:** Read-only operations (SELECT, COUNT, DESCRIBE)
- **Medium Risk:** Data creation (INSERT, BULK_INSERT, OPTIMIZE)
- **High Risk:** Data modification/deletion (UPDATE, DELETE, CUSTOM_QUERY)

### Destructive Flag
Tools marked as destructive:
- `update_record`
- `delete_record`

These show additional warnings in the permission dialog.

### Audit Logging
All tool executions are logged with:
- User, connection, tool name
- Permission status (granted/denied)
- Auto-approved flag
- Execution status and errors
- Execution time

### Row-Level Security
All permission tables use Supabase RLS:
- Users can only view/modify their own permissions
- Service role has full access for system operations

## API Reference

### Get Tool Registry
```typescript
GET /api/tool-permissions/registry

Response:
{
  success: true,
  data: {
    categories: [...],
    totalTools: 42
  }
}
```

### Get User Permissions
```typescript
GET /api/tool-permissions/connections/:connectionId

Response:
{
  success: true,
  data: [
    {
      id: "uuid",
      scope: "tool",
      toolName: "select_data",
      allowed: true,
      autoApprove: false,
      ...
    }
  ]
}
```

### Check Permission
```typescript
POST /api/tool-permissions/check
Body: {
  toolName: "select_data",
  connectionId: "uuid"
}

Response:
{
  success: true,
  data: {
    granted: true,
    requiresApproval: false,
    autoApprove: false,
    reason: "Tool permission granted"
  }
}
```

### Bulk Update Permissions
```typescript
POST /api/tool-permissions/bulk-update
Body: {
  connectionId: "uuid",
  permissions: [
    {
      scope: "category",
      categoryName: "data_query",
      allowed: true,
      autoApprove: false
    },
    {
      scope: "tool",
      toolName: "delete_record",
      allowed: true,
      autoApprove: false
    }
  ]
}
```

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Default permissions initialize correctly
- [ ] Permission settings UI loads tool registry
- [ ] Category-level enable/disable all works
- [ ] Individual tool permissions can be toggled
- [ ] Auto-approve flag works correctly
- [ ] Changes are persisted to database
- [ ] Permission dialog appears in chat
- [ ] Execute once grants temporary permission
- [ ] Execute & remember saves permission
- [ ] Deny prevents tool execution
- [ ] Audit logs are created
- [ ] High-risk tools show warnings
- [ ] Destructive tools show special badges
- [ ] Reset to defaults works

## Troubleshooting

### Permissions Not Saving
- Check browser console for API errors
- Verify user has valid authentication token
- Check RLS policies in Supabase

### Tools Still Denied After Granting Permission
- Clear React Query cache
- Refresh the page
- Verify permission was saved in database

### Permission Dialog Not Appearing
- Check that tool execution returns `PERMISSION_REQUIRED` error
- Verify dialog state management in chat component
- Check browser console for React errors

## Future Enhancements

1. **Permission Templates:** Pre-defined permission sets (Viewer, Editor, Admin)
2. **Temporary Permissions:** Time-based permissions that auto-expire
3. **Permission Requests History:** View all past permission requests
4. **Bulk Operations:** Export/import permissions across connections
5. **Permission Analytics:** Track most-used tools, permission denials
6. **Team Permissions:** Share permission configurations across teams

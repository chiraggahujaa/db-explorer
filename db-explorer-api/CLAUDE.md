# Claude Code Guidelines for DB Explorer API

## Git Commit Guidelines

When creating git commits, do not include:
- Claude watermark ("🤖 Generated with [Claude Code](https://claude.ai/code)")
- Co-authored by Claude attribution ("Co-Authored-By: Claude <noreply@anthropic.com>")

Keep commit messages clean and professional without AI attribution.

## Project Overview

DB Explorer API is a database exploration and management platform built with:
- **Runtime**: Node.js with TypeScript (ES Modules)
- **Framework**: Express.js v5
- **Database**: Supabase (PostgreSQL)
- **Testing**: Cypress for E2E testing
- **Architecture**: Layered architecture (Controllers → Services → Database)

## Project Structure

```
src/
├── controllers/     # HTTP request handlers
├── services/        # Business logic layer
├── routes/          # API route definitions
├── middleware/      # Express middleware
├── types/           # TypeScript type definitions
├── validations/     # Zod validation schemas
├── utils/           # Utility functions
├── lib/             # External library configurations
└── tests/           # Test utilities
```

## Architecture Patterns

### 1. Layered Architecture
- **Controllers**: Handle HTTP requests/responses, validation, and authentication
- **Services**: Contain business logic, extend BaseService for CRUD operations
- **Database**: Accessed via Supabase client with RLS policies

### 2. Service Layer Pattern
- All services extend `BaseService` class
- Provides consistent CRUD operations with pagination
- Automatic camelCase/snake_case transformation via `DataMapper`
- Built-in error handling and type safety

### 3. Validation Strategy
- **Input Validation**: Zod schemas in `validations/` directory
- **Parameter Validation**: Common validators (`validateId`, `validatePagination`)
- **Enum Validation**: Centralized enum schemas in `validations/common.ts`

## Code Writing Guidelines

### 1. File Naming Conventions
- **Controllers**: `PascalCase` with `Controller` suffix (e.g., `ItemController.ts`)
- **Services**: `PascalCase` with `Service` suffix (e.g., `ItemService.ts`)
- **Routes**: `kebab-case` (e.g., `items.ts`, `auth.ts`)
- **Types**: `camelCase` (e.g., `item.ts`, `user.ts`)
- **Validations**: Match related entity name (e.g., `item.ts`, `user.ts`)

### 2. TypeScript Configuration
- **Module System**: ES Modules (`"type": "module"` in package.json)
- **Import Style**: Always use `.js` extensions in imports (TypeScript requirement for ES modules)
- **Target**: ESNext with strict mode enabled
- **Types**: Centralized in `src/types/` directory

### 3. API Response Format
```typescript
// Success Response
{
  success: true,
  data: T,
  message?: string
}

// Paginated Response
{
  success: true,
  data: T[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number,
    hasNext: boolean,
    hasPrev: boolean
  }
}

// Error Response
{
  success: false,
  error: string,
  details?: any
}
```

### 4. Service Class Pattern
```typescript
export class YourService extends BaseService {
  constructor() {
    super('table_name');
  }

  // Custom business methods
  async customMethod(params: any): Promise<ApiResponse<any>> {
    // Implementation
  }
}
```

### 5. Controller Pattern
```typescript
export class YourController {
  private service: YourService;

  constructor() {
    this.service = new YourService();
  }

  async methodName(req: Request, res: Response) {
    try {
      // 1. Authentication check
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      // 2. Validation
      const validatedData = schema.parse(req.body);

      // 3. Service call
      const result = await this.service.method(params);

      // 4. Response
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Method error:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}
```

### 6. Data Transformation
- **Database → API**: Automatic snake_case → camelCase via `DataMapper.toCamelCase()`
- **API → Database**: Manual camelCase → snake_case when needed
- **Consistent**: All API responses use camelCase

### 7. Error Handling
- **Validation Errors**: Return 400 with Zod error details
- **Authentication Errors**: Return 401 with descriptive message  
- **Authorization Errors**: Return 403 with descriptive message
- **Not Found Errors**: Return 404 with descriptive message
- **Server Errors**: Return 500 with generic message, log details

### 8. Security Middleware
- **Helmet**: Security headers configuration
- **Rate Limiting**: Different limits for auth, API, and file uploads
- **CORS**: Configured for allowed origins
- **Request Validation**: Content-type validation for API routes
- **Authentication**: JWT-based auth via middleware

### 9. Database Conventions
- **Table Names**: snake_case
- **Column Names**: snake_case  
- **Primary Keys**: `id` (UUID)
- **Timestamps**: `created_at`, `updated_at` (handled by Supabase)
- **RLS**: Row Level Security enabled on all tables

### 10. Testing Guidelines
- **E2E Tests**: Cypress for comprehensive API testing
- **Test Structure**: Organized by feature (auth, items, bookings, etc.)
- **Test Data**: Managed via fixtures and data generators
- **Environment**: Separate test database configuration

## Migration and Rollback Guidelines

### File Naming Conventions
- **Migration files**: `{timestamp}_{description}.sql` (e.g., `20250107000001_create_users_table.sql`)
- **Rollback files**: `{timestamp}_{description}.down.sql` (e.g., `20250107000001_create_users_table.down.sql`)

### Directory Structure
```
db-explorer-api/
├── supabase/
│   ├── migrations/           # Forward migrations
│   ├── rollbacks/           # Rollback scripts (.down.sql files)
│   ├── scripts/             # Utility scripts
│   │   └── rollback.sh     # Rollback execution helper
│   └── seed.sql            # Database seeding
```

### Cross-Referencing Requirements
- **Migration files** must include at the top:
  ```sql
  -- Migration: [Description of what this migration does]
  -- Description: [Brief summary]
  -- Author: [Author name]
  -- Date: YYYY-MM-DD
  -- Rollback: Run ./supabase/scripts/rollback.sh {timestamp}
  ```
- **Rollback files** must include at the top:
  ```sql
  -- Rollback: [Description matching the migration]
  -- Description: Reverses migration {timestamp}_{description}.sql
  -- Author: [Author name]
  -- Date: YYYY-MM-DD
  ```

### Rollback Script Usage
```bash
# Rollback a specific migration (from db-explorer-api directory)
./supabase/scripts/rollback.sh 20250107000001

# The script will:
# 1. Locate the corresponding .down.sql file in rollbacks/
# 2. Confirm the rollback action
# 3. Execute the rollback SQL
# 4. Report success/failure
```

### Best Practices
- Always test rollbacks before deploying migrations
- Keep rollbacks in sync with migration changes
- Document any manual steps required after rollback
- Never modify existing migration files - create new ones
- Rollbacks should completely reverse the migration

## Development Commands

```bash
# Development
npm run dev                    # Start development server with nodemon (NODE_ENV=development)
npm run dev:prod              # Start development server with NODE_ENV=production (uses same .env file)
npm run dev:staging           # Start development server with NODE_ENV=staging (uses same .env file)

# Building
npm run build                  # Compile TypeScript to dist/
npm start                     # Run production build

# Database
npm run db:push               # Push migrations to database
npm run db:reset              # Reset database with fresh data
npm run supabase:generate     # Generate TypeScript types from database

# Database Rollbacks
./scripts/rollback.sh <timestamp>  # Rollback a specific migration

# Testing
npm test                      # Run all Cypress tests
npm run test:auth            # Run authentication tests
npm run test:items           # Run item-related tests
npm run test:smoke           # Run smoke tests
```

## Common Validation Schemas

Import from `src/validations/common.ts`:
- `uuidSchema` - UUID validation
- `emailSchema` - Email format validation
- `passwordSchema` - Strong password requirements
- `paginationSchema` - Page/limit validation
- `validateId(params)` - Validate UUID in URL params
- `validatePagination(query)` - Validate pagination query params

## File Upload Guidelines

- **Size Limit**: 10MB per file
- **Types**: Images, videos, documents, other
- **Storage**: Supabase Storage with RLS policies
- **Validation**: File type and size validation via `fileUploadSchema`
- **Rate Limiting**: 20 uploads per hour per IP

## Environment Configuration

**Note**: This project uses a single `.env` file for all environments. The `NODE_ENV` variable in scripts is used for runtime behavior (logging, error handling, etc.), not for loading different environment files.

Required environment variables (in `.env`):
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production/staging) - set via scripts or manually
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

## Database Schema

### Core Tables

**users**
- `id` UUID (PK), `full_name` VARCHAR(255), `email` VARCHAR(255) UNIQUE
- `phone_number` VARCHAR(20), `gender` ENUM, `dob` DATE, `dob_visibility` ENUM
- `location_id` UUID (FK), `trust_score` DECIMAL(3,2), `is_verified` BOOLEAN
- `avatar_url` TEXT, `bio` TEXT, `is_active` BOOLEAN

**location**
- `id` UUID (PK), `address_line` TEXT, `city` VARCHAR(100), `state` VARCHAR(100)
- `pincode` VARCHAR(20), `country` VARCHAR(100), `latitude/longitude` DECIMAL

**categories**
- `id` UUID (PK), `category_name` VARCHAR(100) UNIQUE, `description` TEXT
- `icon_url` TEXT, `banner_url` TEXT, `parent_category_id` UUID (FK)
- `is_active` BOOLEAN, `sort_order` INTEGER

**file**
- `id` UUID (PK), `user_id` UUID (FK), `name` VARCHAR(255), `url` TEXT
- `file_type` ENUM, `file_size` BIGINT, `mime_type` VARCHAR(100)
- `bucket` VARCHAR(100), `path` TEXT, `original_name` VARCHAR(255)
- `is_public` BOOLEAN

**device**
- `id` UUID (PK), `user_id` UUID (FK), `device_type` ENUM
- `os_version` VARCHAR(50), `app_version` VARCHAR(50), `device_token` TEXT
- `last_login_at` TIMESTAMP, `is_active` BOOLEAN

### Business Logic Tables

**item**
- `id` UUID (PK), `user_id` UUID (FK), `title` VARCHAR(255), `description` TEXT
- `category_id` UUID (FK), `condition` ENUM, `image_urls` TEXT[]
- `status` ENUM, `security_amount` DECIMAL(10,2), `rent_price_per_day` DECIMAL(10,2)
- `location_id` UUID (FK), `delivery_mode` ENUM, `min/max_rental_days` INTEGER
- `is_negotiable` BOOLEAN, `tags` TEXT[], `rating_average` DECIMAL(3,2)

**booking**
- `id` UUID (PK), `item_id` UUID (FK), `lender_user_id/borrower_user_id` UUID (FK)
- `start_date/end_date` DATE, `total_days` INTEGER (generated)
- `daily_rate` DECIMAL(10,2), `total_rent` DECIMAL(10,2), `security_amount` DECIMAL(10,2)
- `total_amount` DECIMAL(10,2) (generated), `booking_status` ENUM
- `pickup/delivery_location` UUID (FK), `rating_by_lender/borrower` INTEGER

**payment**
- `id` UUID (PK), `booking_id` UUID (FK), `user_id` UUID (FK)
- `amount` DECIMAL(10,2), `payment_method` ENUM, `transaction_id` VARCHAR(255)
- `payment_status` ENUM, `gateway_response` JSONB, `refund_amount` DECIMAL(10,2)

**support_req**
- `id` UUID (PK), `user_id` UUID (FK), `issue_type` ENUM
- `subject` VARCHAR(255), `description` TEXT, `booking_id` UUID (FK)
- `priority` INTEGER, `status` ENUM, `resolution` TEXT

### Relationship Tables

**item_image**
- `id` UUID (PK), `item_id` UUID (FK), `file_id` UUID (FK)
- `is_primary` BOOLEAN, `display_order` INTEGER

**user_favorite**
- `id` UUID (PK), `user_id` UUID (FK), `item_id` UUID (FK)

**item_review**
- `id` UUID (PK), `item_id` UUID (FK), `user_id` UUID (FK)
- `booking_id` UUID (FK), `rating` INTEGER, `review_text` TEXT
- `is_verified` BOOLEAN, `helpful_count` INTEGER

### Analytics Tables

**analytics_event**
- `id` UUID (PK), `event_type` VARCHAR(50), `item_id` UUID (FK)
- `user_id` UUID (FK), `session_id` UUID, `device_id` UUID (FK)
- `event_timestamp` TIMESTAMP, `additional_data` JSONB

**item_metric**
- `id` UUID (PK), `item_id` UUID (FK), `metric_date` DATE
- `view_count` INTEGER, `unique_view_count` INTEGER, `booking_count` INTEGER
- `booking_conversion_rate` DECIMAL(5,4), `bounce_rate` DECIMAL(5,4)

**item_view**
- `id` UUID (PK), `user_id` UUID (FK), `item_id` UUID (FK)
- `device_id` UUID (FK), `ip_address` INET, `session_duration` INTEGER

### Key Features
- **Enums**: item_condition, item_status, booking_status, payment_status, delivery_mode, etc.
- **Generated Columns**: total_days, total_amount auto-calculated
- **Triggers**: Auto-updated timestamps, analytics event dates
- **Indexes**: Optimized for queries, time-series data, and relationships

## Performance Considerations

- **Pagination**: Always use pagination for list endpoints
- **Data Mapping**: Optimized camelCase conversion in `DataMapper`
- **Database Queries**: Utilize Supabase query optimization
- **Caching**: Rate limiting includes caching headers
- **Compression**: Gzip compression enabled via middleware
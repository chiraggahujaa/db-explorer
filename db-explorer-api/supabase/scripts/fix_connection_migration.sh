#!/bin/bash

# Script to rollback and re-apply the fixed connection migration
# This fixes the infinite recursion issue in RLS policies

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

TIMESTAMP="20250107000004"
ROLLBACK_FILE="supabase/rollbacks/${TIMESTAMP}_create_database_connections.down.sql"
MIGRATION_FILE="supabase/migrations/${TIMESTAMP}_create_database_connections.sql"

echo -e "${YELLOW}=== Fixing Connection Migration ===${NC}"
echo ""
echo "This script will:"
echo "1. Rollback migration ${TIMESTAMP}"
echo "2. Re-apply the fixed migration"
echo ""

# Check if files exist
if [ ! -f "$ROLLBACK_FILE" ]; then
    echo -e "${RED}Error: Rollback file not found: ${ROLLBACK_FILE}${NC}"
    exit 1
fi

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}Error: Migration file not found: ${MIGRATION_FILE}${NC}"
    exit 1
fi

# Function to execute SQL
execute_sql() {
    local sql_file=$1
    local description=$2
    
    echo -e "${YELLOW}${description}...${NC}"
    
    # Try different connection methods
    if docker ps | grep -q "supabase_db"; then
        CONTAINER_NAME=$(docker ps --format '{{.Names}}' | grep "supabase_db" | head -n 1)
        cat "$sql_file" | docker exec -i "$CONTAINER_NAME" psql -U postgres -d postgres
        return 0
    elif command -v psql &> /dev/null && [ ! -z "$DATABASE_URL" ]; then
        psql "$DATABASE_URL" -f "$sql_file"
        return 0
    elif command -v psql &> /dev/null; then
        # Try local Supabase default
        psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f "$sql_file" 2>/dev/null && return 0
    fi
    
    # If Supabase CLI is available, try using it
    if command -v supabase &> /dev/null; then
        echo -e "${YELLOW}Trying Supabase CLI...${NC}"
        # For rollback, we need to execute SQL directly
        if [ "$description" == "Rolling back migration" ]; then
            supabase db execute --file "$sql_file" 2>/dev/null && return 0
        fi
    fi
    
    return 1
}

# Step 1: Rollback
echo -e "${YELLOW}Step 1: Rolling back migration...${NC}"
if execute_sql "$ROLLBACK_FILE" "Rolling back migration"; then
    echo -e "${GREEN}✅ Rollback completed${NC}"
else
    echo -e "${RED}❌ Rollback failed${NC}"
    echo ""
    echo "Please ensure:"
    echo "1. Docker is running (for local Supabase)"
    echo "2. Or DATABASE_URL is set (for remote database)"
    echo "3. Or Supabase CLI is configured"
    echo ""
    echo "You can also manually execute:"
    echo "  psql \$DATABASE_URL -f $ROLLBACK_FILE"
    echo "  # OR"
    echo "  supabase db execute --file $ROLLBACK_FILE"
    exit 1
fi

echo ""

# Step 2: Re-apply migration
echo -e "${YELLOW}Step 2: Re-applying fixed migration...${NC}"
if execute_sql "$MIGRATION_FILE" "Applying fixed migration"; then
    echo -e "${GREEN}✅ Migration re-applied successfully${NC}"
else
    echo -e "${RED}❌ Migration failed${NC}"
    echo ""
    echo "Please manually apply the migration:"
    echo "  psql \$DATABASE_URL -f $MIGRATION_FILE"
    echo "  # OR"
    echo "  supabase db push"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Migration fix completed successfully!${NC}"
echo ""
echo "The infinite recursion issue in RLS policies has been fixed."


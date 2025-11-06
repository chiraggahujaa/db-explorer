#!/bin/bash

# DB Explorer API Database Rollback Script
# Usage: ./supabase/scripts/rollback.sh <migration_timestamp>
# Example: ./supabase/scripts/rollback.sh 20250107000001

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if timestamp is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Migration timestamp is required${NC}"
    echo "Usage: ./supabase/scripts/rollback.sh <migration_timestamp>"
    echo "Example: ./supabase/scripts/rollback.sh 20250107000001"
    exit 1
fi

TIMESTAMP=$1
ROLLBACK_FILE="supabase/rollbacks/${TIMESTAMP}_*.down.sql"

# Check if rollback file exists
if ! ls $ROLLBACK_FILE 1> /dev/null 2>&1; then
    echo -e "${RED}Error: Rollback file not found for timestamp ${TIMESTAMP}${NC}"
    echo "Looking for: ${ROLLBACK_FILE}"
    exit 1
fi

# Get the actual rollback file name
ROLLBACK_FILE=$(ls supabase/rollbacks/${TIMESTAMP}_*.down.sql)

echo -e "${YELLOW}Found rollback file: ${ROLLBACK_FILE}${NC}"

# Confirm rollback
echo -e "${YELLOW}Are you sure you want to rollback migration ${TIMESTAMP}? (y/N)${NC}"
read -r response
if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Rollback cancelled${NC}"
    exit 0
fi

# Execute rollback
echo -e "${YELLOW}Executing rollback...${NC}"

# Try different methods to execute the rollback
if docker ps | grep -q "supabase_db"; then
    # Use Docker if Supabase container is running
    CONTAINER_NAME=$(docker ps --format '{{.Names}}' | grep "supabase_db" | head -n 1)
    cat "$ROLLBACK_FILE" | docker exec -i "$CONTAINER_NAME" psql -U postgres -d postgres
elif command -v psql &> /dev/null && [ ! -z "$DATABASE_URL" ]; then
    # Use psql directly if available and DATABASE_URL is set
    psql "$DATABASE_URL" -f "$ROLLBACK_FILE"
elif command -v psql &> /dev/null; then
    # Use psql with default local database
    psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f "$ROLLBACK_FILE"
else
    echo -e "${RED}Error: No suitable database connection method found${NC}"
    echo "Please ensure either:"
    echo "1. Supabase is running locally (supabase start)"
    echo "2. psql is installed and DATABASE_URL is set"
    exit 1
fi

echo -e "${GREEN}✅ Rollback completed successfully!${NC}"
echo -e "${YELLOW}Note: You may need to run additional cleanup or re-run previous migrations${NC}"
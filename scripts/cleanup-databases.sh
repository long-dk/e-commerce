#!/bin/bash

##############################################################################
# Database Cleanup Script
#
# This script safely cleans up all service databases. Use with caution!
# This is useful for development and testing.
#
# Usage:
#   bash scripts/cleanup-databases.sh [--confirm]
#
# Options:
#   --confirm    Skip confirmation prompt (useful for automation)
#
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Configuration
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_USER="${DATABASE_USER:-ecommerce_user}"
DB_PASSWORD="${DATABASE_PASSWORD:-ecommerce_password}"

MONGO_HOST="${MONGODB_HOST:-localhost}"
MONGO_PORT="${MONGODB_PORT:-27017}"
MONGO_USER="${MONGODB_USER:-ecommerce_user}"
MONGO_PASSWORD="${MONGODB_PASSWORD:-ecommerce_password}"

# Service databases
POSTGRES_DATABASES=(
    "${AUTH_SERVICE_DATABASE_NAME:-auth_db}"
    "${ORDERS_SERVICE_DATABASE_NAME:-orders_db}"
    "${PAYMENTS_SERVICE_DATABASE_NAME:-payments_db}"
    "${SHIPPING_SERVICE_DATABASE_NAME:-shipping_db}"
    "${NOTIFICATIONS_SERVICE_DATABASE_NAME:-notifications_db}"
)

MONGO_DATABASES=(
    "${PRODUCTS_SERVICE_DATABASE_NAME:-products_db}"
    "${INVENTORY_SERVICE_DATABASE_NAME:-inventory_db}"
)

echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
echo -e "${RED}DATABASE CLEANUP${NC}"
echo -e "${RED}WARNING: This will delete all data in service databases!${NC}"
echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Databases to be deleted:"
echo -e "  ${YELLOW}PostgreSQL:${NC}"
for db in "${POSTGRES_DATABASES[@]}"; do
    echo -e "    - $db"
done
echo -e "  ${YELLOW}MongoDB:${NC}"
for db in "${MONGO_DATABASES[@]}"; do
    echo -e "    - $db"
done
echo ""

# Confirmation
if [ "$1" != "--confirm" ]; then
    read -p "Are you sure you want to delete all these databases? Type 'yes' to confirm: " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Cancelled."
        exit 0
    fi
fi

echo ""
echo -e "${BLUE}Cleaning up PostgreSQL databases...${NC}"

# Check PostgreSQL connection
if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}Error: Cannot connect to PostgreSQL${NC}"
    exit 1
fi

# Drop PostgreSQL databases
for db in "${POSTGRES_DATABASES[@]}"; do
    echo -n "  Dropping $db... "
    # Terminate connections to the database
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d postgres \
        -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$db';" > /dev/null 2>&1 || true
    
    # Drop the database
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d postgres \
        -c "DROP DATABASE IF EXISTS \"$db\";" > /dev/null 2>&1
    echo -e "${GREEN}✓${NC}"
done

echo ""
echo -e "${BLUE}Cleaning up MongoDB databases...${NC}"

# Check MongoDB connection
if ! mongosh --host "$MONGO_HOST" --port "$MONGO_PORT" -u "$MONGO_USER" -p "$MONGO_PASSWORD" \
    --authenticationDatabase admin --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo -e "${YELLOW}Warning: Cannot connect to MongoDB, skipping MongoDB cleanup${NC}"
else
    # Drop MongoDB databases
    for db in "${MONGO_DATABASES[@]}"; do
        echo -n "  Dropping $db... "
        mongosh --host "$MONGO_HOST" --port "$MONGO_PORT" -u "$MONGO_USER" -p "$MONGO_PASSWORD" \
            --authenticationDatabase admin --eval "db.getSiblingDB('$db').dropDatabase()" > /dev/null 2>&1
        echo -e "${GREEN}✓${NC}"
    done
fi

echo ""
echo -e "${GREEN}Cleanup complete!${NC}"
echo -e "${YELLOW}To recreate the databases, run: bash scripts/setup-databases.sh${NC}"
echo ""

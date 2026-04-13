#!/bin/bash

##############################################################################
# Database Per Service Setup Script
# 
# This script creates all service-specific databases for the e-commerce
# microservices architecture. Each service has its own isolated database.
#
# Prerequisites:
#   - Docker and Docker Compose running
#   - PostgreSQL and MongoDB containers running
#   - .env file configured with database credentials
#
# Usage:
#   bash scripts/setup-databases.sh [--reset]
#
# Options:
#   --reset    Drop and recreate all databases (WARNING: data loss)
#
##############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if reset flag is passed
RESET=false
if [ "$1" == "--reset" ]; then
    RESET=true
    echo -e "${YELLOW}WARNING: All databases will be reset and data will be lost!${NC}"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Cancelled."
        exit 0
    fi
fi

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Database Per Service Setup${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ============================================================================
# PostgreSQL Setup
# ============================================================================

echo -e "${BLUE}Setting up PostgreSQL databases...${NC}"

# Check PostgreSQL connection
echo -e "${YELLOW}Checking PostgreSQL connection...${NC}"
if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${RED}Error: Cannot connect to PostgreSQL at $DB_HOST:$DB_PORT${NC}"
    echo "Make sure PostgreSQL is running and credentials are correct."
    exit 1
fi
echo -e "${GREEN}✓ PostgreSQL connection successful${NC}"
echo ""

# Reset PostgreSQL if requested
if [ "$RESET" = true ]; then
    echo -e "${YELLOW}Dropping existing PostgreSQL databases...${NC}"
    for db in "${POSTGRES_DATABASES[@]}"; do
        echo -n "  Dropping $db... "
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$db\";" > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC}"
        else
            # Database might be in use, try with FORCE if supported (PostgreSQL 13+)
            PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "DELETE FROM pg_database WHERE datname = '$db';" > /dev/null 2>&1 || true
            echo -e "${GREEN}✓${NC}"
        fi
    done
    echo ""
fi

# Create PostgreSQL databases and grant permissions
echo -e "${YELLOW}Creating PostgreSQL databases...${NC}"
for db in "${POSTGRES_DATABASES[@]}"; do
    echo -n "  Creating $db... "
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "CREATE DATABASE IF NOT EXISTS \"$db\";" 2>/dev/null || \
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$db\";" 2>/dev/null || \
    true
    
    # Grant permissions
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$db" -c "GRANT ALL PRIVILEGES ON DATABASE \"$db\" TO \"$DB_USER\";" > /dev/null 2>&1 || true
    
    echo -e "${GREEN}✓${NC}"
done
echo ""

# List created PostgreSQL databases
echo -e "${YELLOW}PostgreSQL databases:${NC}"
for db in "${POSTGRES_DATABASES[@]}"; do
    echo -e "  ${GREEN}✓${NC} $db"
done
echo ""

# ============================================================================
# MongoDB Setup
# ============================================================================

echo -e "${BLUE}Setting up MongoDB databases...${NC}"

# Check MongoDB connection
echo -e "${YELLOW}Checking MongoDB connection...${NC}"
if ! mongosh --host "$MONGO_HOST" --port "$MONGO_PORT" -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo -e "${YELLOW}Warning: Cannot connect to MongoDB at $MONGO_HOST:$MONGO_PORT${NC}"
    echo "Make sure MongoDB is running and credentials are correct."
    echo "Skipping MongoDB setup..."
    echo ""
else
    echo -e "${GREEN}✓ MongoDB connection successful${NC}"
    echo ""
    
    # Reset MongoDB if requested
    if [ "$RESET" = true ]; then
        echo -e "${YELLOW}Dropping existing MongoDB databases...${NC}"
        for db in "${MONGO_DATABASES[@]}"; do
            echo -n "  Dropping $db... "
            mongosh --host "$MONGO_HOST" --port "$MONGO_PORT" -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin \
                --eval "db.getSiblingDB('$db').dropDatabase()" > /dev/null 2>&1
            echo -e "${GREEN}✓${NC}"
        done
        echo ""
    fi
    
    # Create MongoDB databases (implicit creation when first collection is created)
    echo -e "${YELLOW}Creating MongoDB databases...${NC}"
    for db in "${MONGO_DATABASES[@]}"; do
        echo -n "  Creating $db... "
        mongosh --host "$MONGO_HOST" --port "$MONGO_PORT" -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin \
            --eval "db.getSiblingDB('$db').createCollection('_init')" > /dev/null 2>&1 || true
        mongosh --host "$MONGO_HOST" --port "$MONGO_PORT" -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin \
            --eval "db.getSiblingDB('$db').getCollection('_init').deleteOne({})" > /dev/null 2>&1 || true
        echo -e "${GREEN}✓${NC}"
    done
    echo ""
    
    # List created MongoDB databases
    echo -e "${YELLOW}MongoDB databases:${NC}"
    for db in "${MONGO_DATABASES[@]}"; do
        echo -e "  ${GREEN}✓${NC} $db"
    done
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Database setup complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Service Database Mapping:${NC}"
echo -e "  Auth Service:          ${GREEN}auth_db${NC} (PostgreSQL)"
echo -e "  Orders Service:        ${GREEN}orders_db${NC} (PostgreSQL)"
echo -e "  Payments Service:      ${GREEN}payments_db${NC} (PostgreSQL)"
echo -e "  Shipping Service:      ${GREEN}shipping_db${NC} (PostgreSQL)"
echo -e "  Notifications Service: ${GREEN}notifications_db${NC} (PostgreSQL)"
echo -e "  Products Service:      ${GREEN}products_db${NC} (MongoDB)"
echo -e "  Inventory Service:     ${GREEN}inventory_db${NC} (MongoDB)"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Update your .env file with DATABASE_* variables if needed"
echo "  2. Start your services: docker-compose up"
echo "  3. Services will auto-synchronize tables in development mode"
echo ""

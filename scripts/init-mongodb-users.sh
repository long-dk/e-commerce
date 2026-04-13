#!/bin/bash

##############################################################################
# MongoDB User Setup Script
#
# Creates MongoDB users for each service with appropriate permissions.
# This improves security by limiting each service to only its own database.
#
# Prerequisites:
#   - MongoDB running with admin user
#   - mongosh CLI tool installed
#
# Usage:
#   bash scripts/init-mongodb-users.sh
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

# MongoDB Configuration
MONGO_HOST="${MONGODB_HOST:-localhost}"
MONGO_PORT="${MONGODB_PORT:-27017}"
ADMIN_USER="${MONGODB_USER:-ecommerce_user}"
ADMIN_PASSWORD="${MONGODB_PASSWORD:-ecommerce_password}"

# Service databases
PRODUCTS_DB="${PRODUCTS_SERVICE_DATABASE_NAME:-products_db}"
INVENTORY_DB="${INVENTORY_SERVICE_DATABASE_NAME:-inventory_db}"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}MongoDB User Setup${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Check MongoDB connection
echo -e "${YELLOW}Checking MongoDB connection...${NC}"
if ! mongosh --host "$MONGO_HOST" --port "$MONGO_PORT" -u "$ADMIN_USER" -p "$ADMIN_PASSWORD" \
    --authenticationDatabase admin --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo -e "${RED}Error: Cannot connect to MongoDB at $MONGO_HOST:$MONGO_PORT${NC}"
    echo "Make sure MongoDB is running with proper admin credentials."
    exit 1
fi
echo -e "${GREEN}✓ MongoDB connection successful${NC}"
echo ""

# Create service-specific users
echo -e "${BLUE}Creating MongoDB service users...${NC}"
echo ""

# Products Service User
echo -n "  Creating products_user for $PRODUCTS_DB... "
mongosh --host "$MONGO_HOST" --port "$MONGO_PORT" -u "$ADMIN_USER" -p "$ADMIN_PASSWORD" \
    --authenticationDatabase admin << EOF > /dev/null 2>&1
use $PRODUCTS_DB
db.createUser({
    user: "products_user",
    pwd: "products_password",
    roles: [
        { role: "readWrite", db: "$PRODUCTS_DB" },
        { role: "dbAdmin", db: "$PRODUCTS_DB" }
    ]
})
EOF
echo -e "${GREEN}✓${NC}"

# Inventory Service User
echo -n "  Creating inventory_user for $INVENTORY_DB... "
mongosh --host "$MONGO_HOST" --port "$MONGO_PORT" -u "$ADMIN_USER" -p "$ADMIN_PASSWORD" \
    --authenticationDatabase admin << EOF > /dev/null 2>&1
use $INVENTORY_DB
db.createUser({
    user: "inventory_user",
    pwd: "inventory_password",
    roles: [
        { role: "readWrite", db: "$INVENTORY_DB" },
        { role: "dbAdmin", db: "$INVENTORY_DB" }
    ]
})
EOF
echo -e "${GREEN}✓${NC}"

echo ""
echo -e "${GREEN}MongoDB users created successfully!${NC}"
echo ""
echo -e "${YELLOW}Service Credentials:${NC}"
echo ""
echo "  Products Service:"
echo "    User: products_user"
echo "    Password: products_password"
echo "    Database: $PRODUCTS_DB"
echo "    Connection: mongodb://products_user:products_password@$MONGO_HOST:$MONGO_PORT/$PRODUCTS_DB"
echo ""
echo "  Inventory Service:"
echo "    User: inventory_user"
echo "    Password: inventory_password"
echo "    Database: $INVENTORY_DB"
echo "    Connection: mongodb://inventory_user:inventory_password@$MONGO_HOST:$MONGO_PORT/$INVENTORY_DB"
echo ""
echo -e "${YELLOW}Security Note:${NC}"
echo "  For production, use strong, randomly generated passwords!"
echo "  Update the credentials in your configuration management system."
echo ""

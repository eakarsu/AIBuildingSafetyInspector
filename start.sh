#!/bin/bash

# ============================================================
# AI Building Safety Inspector - Start Script
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║        🏗️  AI Building Safety Inspector                 ║"
echo "║        Construction Safety Management Platform          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Load env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

BACKEND_PORT=${BACKEND_PORT:-3001}
FRONTEND_PORT=${FRONTEND_PORT:-3000}
DB_NAME=${DB_NAME:-building_safety_inspector}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

# Function to kill process on a port
kill_port() {
  local port=$1
  local pid=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pid" ]; then
    echo -e "${YELLOW}⚡ Killing process on port $port (PID: $pid)${NC}"
    kill -9 $pid 2>/dev/null || true
    sleep 1
  fi
}

# Cleanup function
cleanup() {
  echo -e "\n${YELLOW}🛑 Shutting down services...${NC}"
  kill_port $BACKEND_PORT
  kill_port $FRONTEND_PORT
  # Kill background processes
  jobs -p | xargs -r kill 2>/dev/null || true
  echo -e "${GREEN}✅ All services stopped${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# Step 1: Clean up used ports
echo -e "${BLUE}📌 Step 1: Cleaning up used ports...${NC}"
kill_port $BACKEND_PORT
kill_port $FRONTEND_PORT
echo -e "${GREEN}✅ Ports $BACKEND_PORT and $FRONTEND_PORT are free${NC}"

# Step 2: Check PostgreSQL
echo -e "\n${BLUE}📌 Step 2: Checking PostgreSQL...${NC}"
if command -v pg_isready &>/dev/null; then
  if pg_isready -h $DB_HOST -p $DB_PORT &>/dev/null; then
    echo -e "${GREEN}✅ PostgreSQL is running${NC}"
  else
    echo -e "${YELLOW}⚡ Starting PostgreSQL...${NC}"
    if command -v brew &>/dev/null; then
      brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
    fi
    sleep 2
    if ! pg_isready -h $DB_HOST -p $DB_PORT &>/dev/null; then
      echo -e "${RED}❌ PostgreSQL is not running. Please start it manually.${NC}"
      exit 1
    fi
  fi
else
  echo -e "${YELLOW}⚠️  pg_isready not found, assuming PostgreSQL is running${NC}"
fi

# Step 3: Create database if not exists
echo -e "\n${BLUE}📌 Step 3: Setting up database...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" 2>/dev/null | grep -q 1 || \
  PGPASSWORD=$DB_PASSWORD createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME 2>/dev/null || true
echo -e "${GREEN}✅ Database '$DB_NAME' ready${NC}"

# Step 4: Install backend dependencies
echo -e "\n${BLUE}📌 Step 4: Installing backend dependencies...${NC}"
cd "$PROJECT_DIR/backend"
if [ ! -d node_modules ]; then
  npm install
else
  echo -e "${GREEN}✅ Backend dependencies already installed${NC}"
fi

# Step 5: Seed database
echo -e "\n${BLUE}📌 Step 5: Seeding database with sample data...${NC}"
cd "$PROJECT_DIR/backend"
node seed.js
echo -e "${GREEN}✅ Database seeded with 15+ items per feature (15 features)${NC}"

# Step 6: Install frontend dependencies
echo -e "\n${BLUE}📌 Step 6: Installing frontend dependencies...${NC}"
cd "$PROJECT_DIR/frontend"
if [ ! -d node_modules ]; then
  npm install
else
  echo -e "${GREEN}✅ Frontend dependencies already installed${NC}"
fi

# Step 7: Start backend with hot reload (nodemon)
echo -e "\n${BLUE}📌 Step 7: Starting backend server with hot reload...${NC}"
cd "$PROJECT_DIR/backend"
npx nodemon server.js &
BACKEND_PID=$!
echo -e "${GREEN}✅ Backend starting on port $BACKEND_PORT (PID: $BACKEND_PID) with hot reload${NC}"

# Wait for backend to be ready
echo -e "${YELLOW}⏳ Waiting for backend...${NC}"
for i in {1..30}; do
  if curl -s "http://localhost:$BACKEND_PORT/api/health" &>/dev/null; then
    echo -e "${GREEN}✅ Backend is ready!${NC}"
    break
  fi
  sleep 1
done

# Step 8: Start frontend with hot reload
echo -e "\n${BLUE}📌 Step 8: Starting frontend with hot reload...${NC}"
cd "$PROJECT_DIR/frontend"
BROWSER=none PORT=$FRONTEND_PORT npm start &
FRONTEND_PID=$!
echo -e "${GREEN}✅ Frontend starting on port $FRONTEND_PORT (PID: $FRONTEND_PID) with hot reload${NC}"

# Final output
echo -e "\n${CYAN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              🎉 Application Started!                    ║"
echo "║                                                        ║"
echo "║  Frontend:  http://localhost:$FRONTEND_PORT                  ║"
echo "║  Backend:   http://localhost:$BACKEND_PORT/api               ║"
echo "║                                                        ║"
echo "║  Login Credentials:                                    ║"
echo "║  Email:    admin@safetyfirst.com                       ║"
echo "║  Password: password123                                 ║"
echo "║                                                        ║"
echo "║  🔄 Hot reload enabled - changes auto-refresh          ║"
echo "║  Press Ctrl+C to stop all services                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Wait for background processes
wait

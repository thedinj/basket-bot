#!/bin/bash
set -e

# ==============================================================================
# PI-DEPLOY GENERIC UPDATE SCRIPT
# ==============================================================================
# Canonical source: basket-bot repo (apps/backend/scripts/update.sh)
# Also installed system-wide as: /usr/local/lib/pi-deploy/update.sh
#
# GETTING STARTED - Updating Basket Bot:
# ----------------------------------------
# 1. SSH into your Raspberry Pi:
#      ssh admin@your-pi-hostname
#
# 2. Navigate to the scripts directory:
#      cd ~/basket-bot/apps/backend/scripts
#
# 3. If update.sh doesn't have execute permissions:
#      chmod +x update.sh
#
# 4. Run the update:
#      ./update.sh
#
# UPDATING OTHER APPS (e.g. Chance-a-Maran):
# -------------------------------------------
# Always update basket-bot first — this re-hoists the latest scripts so
# pi-app-update is current before it runs other apps:
#   cd ~/basket-bot/apps/backend/scripts && ./update.sh
#
# Then update the other app using pi-app-update (preferred) or its thin wrapper:
#   pi-app-update ~/other-app/apps/backend/scripts/deploy.config.sh
#   -- or --
#   cd ~/other-app/apps/backend/scripts && ./update.sh
#
# WHAT THIS SCRIPT DOES:
# ----------------------
# - Backs up the SQLite database
# - Pulls the latest code from git
# - Rebuilds core package, backend, and (if configured) mobile web app
# - Stops the service, runs any pending migrations, then restarts
# - Runs a health check; automatically rolls back on failure
# - Cleans up old backups (retains the last 10)
# ==============================================================================

# --- Self-update: always run the canonical copy next to the project config ---
# When invoked via the hoisted pi-app-update symlink, re-exec from the project's
# own scripts directory so a freshly pulled update.sh takes effect immediately,
# without needing a separate bootstrap step.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${1:-$SCRIPT_DIR/deploy.config.sh}"
_CANONICAL_DIR="$(cd "$(dirname "$CONFIG_FILE")" && pwd 2>/dev/null || true)"
_CANONICAL_SELF="$_CANONICAL_DIR/$(basename "${BASH_SOURCE[0]}")"
if [ -f "$_CANONICAL_SELF" ] && \
   [ "$(readlink -f "${BASH_SOURCE[0]}")" != "$(readlink -f "$_CANONICAL_SELF")" ] && \
   grep -q "PI-DEPLOY GENERIC" "$_CANONICAL_SELF" 2>/dev/null; then
    exec "$_CANONICAL_SELF" "$@"
fi
unset _CANONICAL_DIR _CANONICAL_SELF

# --- Load project config ---

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Config file not found: $CONFIG_FILE"
    echo "   Usage: $0 [/path/to/deploy.config.sh]"
    exit 1
fi

# shellcheck source=/dev/null
source "$CONFIG_FILE"

CONFIG_DIR="$(cd "$(dirname "$CONFIG_FILE")" && pwd)"
PROJECT_ROOT="$(cd "$CONFIG_DIR/../../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/apps/backend"

echo "================================================"
echo "$APP_DISPLAY_NAME Update"
echo "================================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BACKUP_DIR="$BACKEND_DIR/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "Project root: $PROJECT_ROOT"
echo "Backend directory: $BACKEND_DIR"
echo ""

# ================================================================
# PRE-FLIGHT CHECKS
# ================================================================

echo -e "${BLUE}[1/10] Running pre-flight checks...${NC}"
echo ""

CURRENT_USER=$(whoami)
echo "Running as user: $CURRENT_USER"

# Check Node.js
echo "Checking Node.js version..."
NODE_VERSION=$(node --version 2>/dev/null || echo "not found")
if [ "$NODE_VERSION" = "not found" ]; then
    echo -e "${RED}❌ Node.js is not installed.${NC}"
    exit 1
else
    echo -e "${GREEN}✓${NC} Node.js version: $NODE_VERSION"
fi

# Check pnpm
echo "Checking for pnpm..."
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm is not installed.${NC}"
    exit 1
else
    echo -e "${GREEN}✓${NC} pnpm version: $(pnpm --version)"
fi

# Check service exists
echo "Checking service status..."
if ! systemctl list-units --type=service --all | grep -q "$SERVICE_NAME"; then
    echo -e "${RED}❌ Service '$SERVICE_NAME' does not exist.${NC}"
    echo "Run the install.sh script first to set up the service."
    exit 1
fi

SERVICE_STATUS=$(systemctl is-active "$SERVICE_NAME" 2>/dev/null || echo "inactive")
if [ "$SERVICE_STATUS" != "active" ]; then
    echo -e "${YELLOW}⚠️  Service is not running (status: $SERVICE_STATUS)${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} Service is running"
fi

# Check git repo
cd "$PROJECT_ROOT"
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Not a git repository.${NC}"
    exit 1
fi

# Check for uncommitted changes
git update-index -q --refresh 2>/dev/null || true
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  Warning: You have uncommitted changes in your working directory.${NC}"
    git status --short
    echo ""
    read -p "Continue anyway? These changes will be preserved. (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}✓${NC} Pre-flight checks passed"
echo ""

# ================================================================
# CHECK ENVIRONMENT VARIABLES
# ================================================================

echo -e "${BLUE}[2/10] Checking environment configuration...${NC}"
echo ""

ENV_FILE="$BACKEND_DIR/.env"
ENV_EXAMPLE="$BACKEND_DIR/.env.example"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ .env file not found at $ENV_FILE${NC}"
    echo "Run the install.sh script first to set up the environment."
    exit 1
fi

REQUIRED_VARS=(
    "JWT_SECRET"
    "ADMIN_EMAIL"
    "ADMIN_NAME"
    "ADMIN_PASSWORD"
    "NODE_ENV"
)

MISSING_VARS=()
for VAR in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${VAR}=" "$ENV_FILE"; then
        MISSING_VARS+=("$VAR")
    else
        VAR_VALUE=$(grep "^${VAR}=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
        if [ -z "$VAR_VALUE" ]; then
            MISSING_VARS+=("$VAR (empty)")
        fi
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing or empty required environment variables:${NC}"
    for VAR in "${MISSING_VARS[@]}"; do
        echo "   - $VAR"
    done
    echo ""
    echo "Please update $ENV_FILE with the required values."
    exit 1
fi

# Check for new variables in .env.example that don't exist in .env
echo "Checking for new environment variables..."
NEW_VARS=()
while IFS= read -r line; do
    if [[ $line =~ ^#.*$ ]] || [[ -z $line ]]; then
        continue
    fi
    if [[ $line =~ ^([A-Z_]+)= ]]; then
        VAR_NAME="${BASH_REMATCH[1]}"
        if ! grep -q "^${VAR_NAME}=" "$ENV_FILE"; then
            NEW_VARS+=("$VAR_NAME")
        fi
    fi
done < "$ENV_EXAMPLE"

if [ ${#NEW_VARS[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  New environment variables found in .env.example:${NC}"
    for VAR in "${NEW_VARS[@]}"; do
        echo "   - $VAR"
    done
    echo ""
    echo "These variables are not in your .env file."
    echo "They may be optional, but please review .env.example and update .env if needed."
    echo ""
    read -p "Continue with update? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}✓${NC} Environment configuration OK"
echo ""

# ================================================================
# BACKUP
# ================================================================

echo -e "${BLUE}[3/10] Creating backup...${NC}"
echo ""

mkdir -p "$BACKUP_DIR"

CURRENT_COMMIT=$(git rev-parse HEAD)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Current commit: $CURRENT_COMMIT ($CURRENT_BRANCH)"

DB_PATH="$BACKEND_DIR/database.db"

if [ -f "$DB_PATH" ]; then
    BACKUP_DB="$BACKUP_DIR/database-backup-$TIMESTAMP.db"
    cp "$DB_PATH" "$BACKUP_DB"
    echo -e "${GREEN}✓${NC} Database backed up to: $BACKUP_DB"
else
    echo -e "${YELLOW}⚠️  Database file not found at $DB_PATH (this may be OK for a new installation)${NC}"
fi

echo "$CURRENT_COMMIT" > "$BACKUP_DIR/last-commit-$TIMESTAMP.txt"
echo -e "${GREEN}✓${NC} Backup completed"
echo ""

# ================================================================
# PULL LATEST CODE
# ================================================================

echo -e "${BLUE}[4/10] Pulling latest code...${NC}"
echo ""

STASH_NEEDED=false
if ! git diff-index --quiet HEAD --; then
    echo "Stashing uncommitted changes..."
    git stash push -m "Auto-stash before update at $TIMESTAMP"
    STASH_NEEDED=true
fi

echo "Fetching updates from origin/$CURRENT_BRANCH..."
git fetch origin
git pull origin "$CURRENT_BRANCH"

NEW_COMMIT=$(git rev-parse HEAD)
if [ "$CURRENT_COMMIT" = "$NEW_COMMIT" ]; then
    echo -e "${GREEN}✓${NC} Already up to date (no new commits)"
else
    echo -e "${GREEN}✓${NC} Updated from $CURRENT_COMMIT to $NEW_COMMIT"
    echo ""
    echo "New commits:"
    git log --oneline "$CURRENT_COMMIT..$NEW_COMMIT"
fi

if [ "$STASH_NEEDED" = true ]; then
    echo ""
    echo "Restoring stashed changes..."
    git stash pop || echo -e "${YELLOW}⚠️  Could not automatically restore stashed changes (resolve manually later)${NC}"
fi

echo ""

# ================================================================
# BUILD (BEFORE STOPPING SERVICE - MINIMIZE DOWNTIME)
# ================================================================

echo -e "${BLUE}[5/10] Building packages...${NC}"
echo ""

cd "$PROJECT_ROOT"

# Ensure enough virtual memory — Next.js/Vite builds need ~1.4 GB.
SWAPFILE_CREATED=false
SWAPFILE_PATH="/tmp/pi-deploy-build.swap"

mem_kb=$(grep MemAvailable /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0)
swap_kb=$(grep SwapFree /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0)
total_kb=$((mem_kb + swap_kb))
echo "Available memory: $((mem_kb / 1024))MB RAM + $((swap_kb / 1024))MB swap = $((total_kb / 1024))MB"

# Raise V8's heap ceiling beyond the ~512 MB default on 32-bit ARM.
export NODE_OPTIONS="--max-old-space-size=1024"
echo -e "${GREEN}✓${NC} NODE_OPTIONS set (--max-old-space-size=1024)"

if [ "$total_kb" -lt 1400000 ]; then
    echo -e "${YELLOW}⚠️  Less than 1.4 GB available — creating temporary swapfile for build...${NC}"
    sudo fallocate -l 1G "$SWAPFILE_PATH" 2>/dev/null || sudo dd if=/dev/zero of="$SWAPFILE_PATH" bs=1M count=1024 status=none
    sudo chmod 600 "$SWAPFILE_PATH"
    sudo mkswap "$SWAPFILE_PATH" > /dev/null
    sudo swapon "$SWAPFILE_PATH"
    SWAPFILE_CREATED=true
    echo -e "${GREEN}✓${NC} Temporary swapfile active"
else
    echo -e "${GREEN}✓${NC} Sufficient memory for build"
fi
echo ""

echo "Installing/updating dependencies..."
pnpm install
echo -e "${GREEN}✓${NC} Dependencies updated"
echo ""

echo "Building core package ($CORE_PACKAGE)..."
pnpm --filter "$CORE_PACKAGE" build
echo -e "${GREEN}✓${NC} Core package built"
echo ""

echo "Building backend..."
cd "$BACKEND_DIR"
pnpm build
echo -e "${GREEN}✓${NC} Backend built"
echo ""

if [ "$HAS_MOBILE_APP" = true ]; then
    echo "Building mobile web app..."
    cd "$PROJECT_ROOT"
    pnpm --filter mobile build
    echo -e "${GREEN}✓${NC} Mobile web app built"
    echo ""
fi

# Release temporary swap now that all builds are done
if [ "$SWAPFILE_CREATED" = true ]; then
    echo "Removing temporary swapfile..."
    sudo swapoff "$SWAPFILE_PATH" 2>/dev/null || true
    sudo rm -f "$SWAPFILE_PATH"
    echo -e "${GREEN}✓${NC} Temporary swapfile removed"
    echo ""
fi

# ================================================================
# STOP SERVICE
# ================================================================

echo -e "${BLUE}[6/10] Stopping service...${NC}"
echo ""

if [ "$SERVICE_STATUS" = "active" ]; then
    echo "Stopping $SERVICE_NAME..."
    sudo systemctl stop "$SERVICE_NAME"
    echo -e "${GREEN}✓${NC} Service stopped"
else
    echo "Service was not running, skipping stop"
fi
echo ""

# ================================================================
# RUN MIGRATIONS (IF ANY)
# ================================================================

echo -e "${BLUE}[7/10] Running database migrations...${NC}"
echo ""

MIGRATIONS_DIR="$BACKEND_DIR/src/db/migrations"
if [ -d "$MIGRATIONS_DIR" ] && [ -n "$(ls -A $MIGRATIONS_DIR 2>/dev/null)" ]; then
    echo "Found migrations directory, running migrations..."
    cd "$BACKEND_DIR"
    if grep -q '"db:migrate"' package.json; then
        pnpm db:migrate
        echo -e "${GREEN}✓${NC} Migrations completed"
    else
        echo -e "${YELLOW}⚠️  Migrations directory exists but no 'db:migrate' script found in package.json${NC}"
        echo "If you need to run migrations manually, do so now."
        read -p "Press Enter to continue..."
    fi
else
    echo "No migrations found, skipping"
    echo -e "${GREEN}✓${NC} No migrations to run"
fi
echo ""

# ================================================================
# START SERVICE
# ================================================================

echo -e "${BLUE}[8/10] Starting service...${NC}"
echo ""

echo "Starting $SERVICE_NAME..."
sudo systemctl start "$SERVICE_NAME"

echo "Waiting for service to start..."
sleep 5

echo -e "${GREEN}✓${NC} Service start command executed"
echo ""

# ================================================================
# HEALTH CHECK
# ================================================================

echo -e "${BLUE}[9/10] Running health checks...${NC}"
echo ""

SERVICE_STATUS=$(systemctl is-active "$SERVICE_NAME" 2>/dev/null || echo "failed")
if [ "$SERVICE_STATUS" != "active" ]; then
    echo -e "${RED}❌ Service failed to start (status: $SERVICE_STATUS)${NC}"
    echo ""
    echo "Recent logs:"
    sudo journalctl -u "$SERVICE_NAME" -n 50 --no-pager
    echo ""
    echo -e "${RED}Update failed. Starting rollback...${NC}"

    # ROLLBACK
    echo ""
    echo "Stopping failed service..."
    sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true

    echo "Restoring database backup..."
    if [ -f "$BACKUP_DB" ]; then
        cp "$BACKUP_DB" "$DB_PATH"
        echo -e "${GREEN}✓${NC} Database restored"
    fi

    echo "Checking out previous commit..."
    cd "$PROJECT_ROOT"
    git checkout "$CURRENT_COMMIT"

    echo "Rebuilding previous version..."
    pnpm install
    pnpm --filter "$CORE_PACKAGE" build
    cd "$BACKEND_DIR"
    pnpm build

    echo "Starting service with previous version..."
    sudo systemctl start "$SERVICE_NAME"
    sleep 5

    ROLLBACK_STATUS=$(systemctl is-active "$SERVICE_NAME" 2>/dev/null || echo "failed")
    if [ "$ROLLBACK_STATUS" = "active" ]; then
        echo -e "${GREEN}✓${NC} Rollback successful - service restored to previous version"
    else
        echo -e "${RED}❌ Rollback failed - manual intervention required${NC}"
        sudo journalctl -u "$SERVICE_NAME" -n 50 --no-pager
    fi

    exit 1
fi

echo -e "${GREEN}✓${NC} Service is active"

# Test API health endpoint
PORT=$(grep "^PORT=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo "3000")
echo "Testing API endpoint on port $PORT..."

MAX_RETRIES=5
RETRY_COUNT=0
HTTP_STATUS="000"

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if [ $RETRY_COUNT -gt 0 ]; then
        echo "Retry $RETRY_COUNT/$MAX_RETRIES - waiting 3 seconds..."
    fi
    sleep 3

    HTTP_STATUS=$(curl --max-time 10 -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/health" 2>/dev/null || true)

    if [ -z "$HTTP_STATUS" ] || [ ${#HTTP_STATUS} -ne 3 ]; then
        HTTP_STATUS="000"
    fi

    echo "Response code: $HTTP_STATUS"

    if [ "$HTTP_STATUS" = "200" ]; then
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓${NC} API health check passed (HTTP $HTTP_STATUS)"
elif [ "$HTTP_STATUS" = "404" ]; then
    echo -e "${YELLOW}⚠️  Health endpoint not found (HTTP 404) - service may still be OK${NC}"
elif [ "$HTTP_STATUS" = "000" ]; then
    echo -e "${YELLOW}⚠️  Could not connect to API (curl failed) - may need more time to start${NC}"
else
    echo -e "${YELLOW}⚠️  Unexpected health check response (HTTP $HTTP_STATUS)${NC}"
fi

echo ""
echo "Recent service logs:"
sudo journalctl -u "$SERVICE_NAME" -n 20 --no-pager | tail -10
echo ""

echo -e "${GREEN}✓${NC} Health checks completed"
echo ""

# ================================================================
# CLEANUP
# ================================================================

echo -e "${BLUE}[10/10] Cleanup...${NC}"
echo ""

echo "Cleaning old backups (keeping last 10)..."
cd "$BACKUP_DIR"
ls -t database-backup-*.db 2>/dev/null | tail -n +11 | xargs -r rm
ls -t last-commit-*.txt 2>/dev/null | tail -n +11 | xargs -r rm
BACKUP_COUNT=$(ls -1 database-backup-*.db 2>/dev/null | wc -l)
echo -e "${GREEN}✓${NC} Cleanup complete ($BACKUP_COUNT backups retained)"
echo ""

echo "Updating shared deploy scripts system-wide..."
DEPLOY_LIB="/usr/local/lib/pi-deploy"
if [ -f "$SCRIPT_DIR/install.sh" ] && [ -f "$SCRIPT_DIR/update.sh" ]; then
    sudo mkdir -p "$DEPLOY_LIB"
    sudo cp "$SCRIPT_DIR/install.sh" "$DEPLOY_LIB/install.sh"
    sudo cp "$SCRIPT_DIR/update.sh"  "$DEPLOY_LIB/update.sh"
    sudo chmod +x "$DEPLOY_LIB/install.sh" "$DEPLOY_LIB/update.sh"
    sudo ln -sf "$DEPLOY_LIB/install.sh" /usr/local/bin/pi-app-install
    sudo ln -sf "$DEPLOY_LIB/update.sh"  /usr/local/bin/pi-app-update
    echo -e "${GREEN}✓${NC} pi-app-install and pi-app-update updated system-wide"
else
    echo -e "${YELLOW}⚠️  install.sh/update.sh not found next to this script — skipping bootstrap${NC}"
fi
echo ""

# ================================================================
# SUMMARY
# ================================================================

echo "================================================"
echo -e "${GREEN}Update completed successfully!${NC}"
echo "================================================"
echo ""
echo "Summary:"
echo "  • Previous commit: $CURRENT_COMMIT"
echo "  • New commit: $NEW_COMMIT"
echo "  • Service status: $(systemctl is-active $SERVICE_NAME)"
if [ -n "$BACKUP_DB" ]; then
    echo "  • Backup location: $BACKUP_DB"
fi
echo ""
echo "Useful commands:"
echo "  • View logs:     sudo journalctl -u $SERVICE_NAME -f"
echo "  • Check status:  sudo systemctl status $SERVICE_NAME"
echo "  • Restart:       sudo systemctl restart $SERVICE_NAME"
echo ""

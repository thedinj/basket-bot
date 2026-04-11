#!/bin/bash
set -e

# ==============================================================================
# PI-DEPLOY GENERIC INSTALLATION SCRIPT
# ==============================================================================
# Canonical source: basket-bot repo (apps/backend/scripts/install.sh)
# Also installed system-wide as: /usr/local/lib/pi-deploy/install.sh
#
# GETTING STARTED - Basket Bot Installation:
# ------------------------------------------
# 1. SSH into your Raspberry Pi as the admin user:
#      ssh admin@your-pi-hostname
#
# 2. Install Node.js v20 if not already installed:
#      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
#      sudo apt-get install -y nodejs
#      node --version && npm --version   # verify
#
# 3. Clone basket-bot (recommended location: ~/basket-bot):
#      cd ~
#      git clone https://github.com/thedinj/basket-bot.git
#
# 4. Disable file mode change tracking:
#      cd ~/basket-bot && git config core.filemode false
#
# 5. Make the scripts executable and run:
#      cd ~/basket-bot/apps/backend/scripts
#      chmod +x install.sh update.sh bootstrap.sh
#      ./install.sh
#
# This script also runs bootstrap.sh at the end, which installs
# pi-app-install and pi-app-update system-wide so you can install
# additional apps (e.g. chance-a-maran) without re-cloning basket-bot.
#
# INSTALLING OTHER APPS:
# ----------------------
# After basket-bot is installed, install other apps with:
#   pi-app-install ~/other-app/apps/backend/scripts/deploy.config.sh
# Or call the app's own thin-wrapper install.sh:
#   cd ~/other-app/apps/backend/scripts && ./install.sh
#
# ADVANCED USAGE:
# ---------------
# Call directly with a different deploy.config.sh to install any app:
#   ./install.sh /path/to/app/apps/backend/scripts/deploy.config.sh
#
# WHAT THIS SCRIPT DOES:
# ----------------------
# - Installs pnpm dependencies across the monorepo
# - Builds shared core package, backend, and (if configured) mobile web SPA
# - Creates apps/backend/.env (prompts you to set admin credentials)
# - Initialises the SQLite database
# - Creates a systemd service for auto-start on boot
# - Installs and configures Caddy (serves mobile SPA + reverse-proxies the API)
# - Optionally configures HTTPS with Let's Encrypt
# - Optionally installs Samba for Windows network file access
# ==============================================================================

# --- Load project config ---
# Config file path: first argument OR deploy.config.sh next to this script.
# IMPORTANT: Project root is derived from the config file's location
# (apps/backend/scripts/deploy.config.sh → project root 3 levels up),
# not from where this script itself lives.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${1:-$SCRIPT_DIR/deploy.config.sh}"

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
echo "$APP_DISPLAY_NAME Installation"
echo "================================================"
echo ""
echo "Project root: $PROJECT_ROOT"
echo "Backend directory: $BACKEND_DIR"
echo ""

# Cleanup function for script failures
SERVICE_CREATED=false
FIREWALL_CONFIGURED=false
cleanup_on_error() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        echo ""
        echo "❌ Installation failed. Cleaning up..."

        # Remove systemd service if created
        if [ "$SERVICE_CREATED" = true ] && [ -n "$SERVICE_NAME" ]; then
            sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true
            sudo systemctl disable "$SERVICE_NAME" 2>/dev/null || true
            sudo rm -f "/etc/systemd/system/$SERVICE_NAME.service" 2>/dev/null || true
            sudo systemctl daemon-reload
            echo "✓ Removed systemd service"
        fi

        echo "⚠️  Partial installation state. You may need to manually clean up:"
        echo "   - Firewall rules (ufw status)"
        echo "   - Samba shares (/etc/samba/smb.conf)"
        echo "   - Caddy config (/etc/caddy/conf.d/$APP_SLUG.caddy)"
    fi
}
trap cleanup_on_error EXIT

# Check if running as admin user
CURRENT_USER=$(whoami)
if [ "$CURRENT_USER" != "admin" ]; then
    echo "⚠️  Warning: This script should be run as the 'admin' user."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if pnpm is installed
echo "Checking for pnpm..."
if ! command -v pnpm &> /dev/null; then
    echo "pnpm not found. Installing pnpm globally..."

    if ! command -v npm &> /dev/null; then
        echo "❌ npm is not installed. Please install Node.js first:"
        echo "   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
        echo "   sudo apt-get install -y nodejs"
        exit 1
    fi

    sudo npm install -g pnpm
else
    echo "✓ pnpm is already installed ($(pnpm --version))"
fi
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node --version 2>/dev/null || echo "not found")
if [ "$NODE_VERSION" = "not found" ]; then
    echo "❌ Node.js is not installed. Please install Node.js v18 or higher."
    exit 1
else
    echo "✓ Node.js version: $NODE_VERSION"
fi
echo ""

# Check if sqlite3 is installed (useful for database inspection)
echo "Checking for sqlite3..."
if ! command -v sqlite3 &> /dev/null; then
    echo "sqlite3 not found. Installing sqlite3..."
    sudo apt-get update
    sudo apt-get install -y sqlite3
    echo "✓ sqlite3 installed"
else
    echo "✓ sqlite3 is already installed ($(sqlite3 --version))"
fi
echo ""

# Install and configure UFW firewall
echo "Checking and configuring firewall (UFW)..."
if ! command -v ufw &> /dev/null; then
    echo "UFW not found. Installing UFW..."
    sudo apt-get update
    sudo apt-get install -y ufw
    echo "✓ UFW installed"
else
    echo "✓ UFW is already installed"
fi

# Check if UFW is enabled
if ! sudo ufw status | grep -q "Status: active"; then
    echo ""
    echo "================================================"
    echo "Firewall Security Configuration"
    echo "================================================"
    echo ""
    echo "⚠️  CRITICAL: UFW firewall is not enabled."
    echo ""
    echo "Before enabling UFW, SSH access (port 22) will be allowed"
    echo "to prevent being locked out of your server."
    echo ""
    echo "The following ports will be configured:"
    echo "  - Port 22  (SSH - for remote access)"
    echo "  - Port 80  (HTTP - required for Let's Encrypt)"
    echo "  - Port 443 (HTTPS)"
    echo ""
    echo "Your backend application port will be added automatically"
    echo "based on your configuration choices."
    echo ""
    read -p "Enable UFW firewall now? (Y/n): " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        # Allow SSH first (critical to prevent lockout!)
        sudo ufw allow 22/tcp
        echo "✓ SSH access allowed (port 22)"

        # Allow common HTTPS ports
        sudo ufw allow 80/tcp
        sudo ufw allow 443/tcp
        echo "✓ HTTP/HTTPS ports allowed (80, 443)"

        # Set defaults
        sudo ufw default deny incoming
        sudo ufw default allow outgoing
        echo "✓ Default policies set (deny incoming, allow outgoing)"

        echo ""
        echo "Enabling UFW firewall..."
        sudo ufw --force enable
        echo "✓ UFW firewall enabled"
        echo ""
        sudo ufw status numbered
    else
        echo "⚠️  Skipping UFW setup. You will need to configure firewall manually."
        echo "   For security, this is NOT recommended for production servers."
    fi
else
    echo "✓ UFW firewall is already enabled"
    echo ""
    echo "Current firewall status:"
    sudo ufw status numbered
fi
echo ""

# Navigate to project root
cd "$PROJECT_ROOT"

# ================================================================
# STOP SERVICE (if running) — prevents file-lock/resource conflicts
# during Vite and backend builds on a re-install
# ================================================================

echo "Checking if service is already running..."
if systemctl list-units --type=service --all 2>/dev/null | grep -q "$SERVICE_NAME"; then
    if sudo systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        echo "Service '$SERVICE_NAME' is running — stopping before build..."
        sudo systemctl stop "$SERVICE_NAME"
        echo "✓ Service stopped"
    else
        echo "✓ Service exists but is not running"
    fi
else
    echo "✓ No existing service found (fresh install)"
fi
echo ""

# ================================================================
# BACKUP DATABASE (if one already exists)
# ================================================================

BACKUP_DIR="$BACKEND_DIR/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DB_PATH="$BACKEND_DIR/database.db"
BACKUP_DB=""   # may be set below; used in cleanup_on_error message

if [ -f "$DB_PATH" ]; then
    echo "Backing up existing database before re-install..."
    mkdir -p "$BACKUP_DIR"
    BACKUP_DB="$BACKUP_DIR/database-backup-$TIMESTAMP.db"
    cp "$DB_PATH" "$BACKUP_DB"
    echo "✓ Database backed up to: $BACKUP_DB"
    echo ""
fi

# ================================================================
# SWAP CHECK — Next.js/Vite builds need ~1.5 GB virtual memory.
# Create a temporary swapfile if RAM+swap is insufficient.
# ================================================================

SWAPFILE_CREATED=false
SWAPFILE_PATH="/tmp/pi-deploy-build.swap"

ensure_swap() {
    local required_kb=1400000   # ~1.4 GB minimum
    local mem_kb swap_kb total_kb
    mem_kb=$(grep MemAvailable /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0)
    swap_kb=$(grep SwapFree /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0)
    total_kb=$((mem_kb + swap_kb))

    echo "Available memory: $((mem_kb / 1024))MB RAM + $((swap_kb / 1024))MB swap = $((total_kb / 1024))MB"

    if [ "$total_kb" -lt "$required_kb" ]; then
        echo "⚠️  Less than $((required_kb / 1024))MB available — creating temporary swapfile for build..."
        sudo fallocate -l 1G "$SWAPFILE_PATH" 2>/dev/null || sudo dd if=/dev/zero of="$SWAPFILE_PATH" bs=1M count=1024 status=none
        sudo chmod 600 "$SWAPFILE_PATH"
        sudo mkswap "$SWAPFILE_PATH" > /dev/null
        sudo swapon "$SWAPFILE_PATH"
        SWAPFILE_CREATED=true
        echo "✓ Temporary swapfile active ($SWAPFILE_PATH)"
    else
        echo "✓ Sufficient memory for build"
    fi
    echo ""
}

remove_swap() {
    if [ "$SWAPFILE_CREATED" = true ]; then
        echo "Removing temporary swapfile..."
        sudo swapoff "$SWAPFILE_PATH" 2>/dev/null || true
        sudo rm -f "$SWAPFILE_PATH"
        SWAPFILE_CREATED=false
        echo "✓ Temporary swapfile removed"
        echo ""
    fi
}

ensure_swap

# Install dependencies
echo "Installing dependencies..."
if ! pnpm install; then
    remove_swap
    echo "❌ Failed to install dependencies"
    exit 1
fi
echo "✓ Dependencies installed"
echo ""

# Build core package
echo "Building core package ($CORE_PACKAGE)..."
if ! pnpm --filter "$CORE_PACKAGE" build; then
    echo "❌ Failed to build core package"
    exit 1
fi
echo "✓ Core package built"
echo ""

# Set up environment file (must be done BEFORE building backend)
echo "Setting up environment file..."
cd "$BACKEND_DIR"
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "Creating .env from .env.example..."
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"

    # Generate a random JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i "s|JWT_SECRET=\"your-secret-key-change-this-in-production\"|JWT_SECRET=\"$JWT_SECRET\"|g" "$BACKEND_DIR/.env"

    # Set production environment
    sed -i 's|NODE_ENV="development"|NODE_ENV="production"|g' "$BACKEND_DIR/.env"

    echo "✓ .env file created with random JWT secret"
else
    echo "✓ .env file already exists"
    echo "Updating NODE_ENV to production..."
    sed -i 's|NODE_ENV="development"|NODE_ENV="production"|g' "$BACKEND_DIR/.env"
fi

echo ""
echo "⚠️  IMPORTANT: Please edit $BACKEND_DIR/.env and verify/update:"
echo "   - ADMIN_EMAIL"
echo "   - ADMIN_NAME"
echo "   - ADMIN_PASSWORD"
echo "   - JWT_SECRET (if using existing .env)"
echo ""
read -p "Press Enter after you've updated the .env file..."
echo ""

# Validate required .env fields
echo "Validating .env configuration..."
ADMIN_EMAIL=$(grep -E '^ADMIN_EMAIL=' "$BACKEND_DIR/.env" | cut -d '=' -f 2 | tr -d '"')
ADMIN_PASSWORD=$(grep -E '^ADMIN_PASSWORD=' "$BACKEND_DIR/.env" | cut -d '=' -f 2 | tr -d '"')

if [ "$ADMIN_EMAIL" = "admin@example.com" ] || [ -z "$ADMIN_EMAIL" ]; then
    echo "❌ ADMIN_EMAIL is not configured in .env file"
    echo "   Please edit $BACKEND_DIR/.env and set a valid admin email"
    exit 1
fi

if [ "$ADMIN_PASSWORD" = "change-this-password" ] || [ -z "$ADMIN_PASSWORD" ]; then
    echo "❌ ADMIN_PASSWORD is not configured in .env file"
    echo "   Please edit $BACKEND_DIR/.env and set a secure admin password"
    exit 1
fi

echo "✓ .env configuration validated"
echo ""

# Check for port conflicts — catch clashes with other apps before the build,
# not after a 4-minute build + service start failure.
PORT=$(grep -E '^PORT=' "$BACKEND_DIR/.env" | cut -d '=' -f 2 | tr -d '"' | tr -d "'" || echo "3000")
if ss -tlnp 2>/dev/null | grep -q ":${PORT} "; then
    PORT_OWNER=$(ss -tlnp 2>/dev/null | grep ":${PORT} " | grep -oP 'pid=\K[0-9]+' | head -1)
    PORT_PROC=$(cat /proc/$PORT_OWNER/comm 2>/dev/null || echo "unknown")
    # Allow if it's our own service (we stopped it above, but double-check)
    if ! systemctl list-units --type=service --all 2>/dev/null | grep -q "$SERVICE_NAME" || \
       ! sudo systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        echo "❌ Port $PORT is already in use by '$PORT_PROC' (pid $PORT_OWNER)."
        echo "   Update PORT= in $BACKEND_DIR/.env to a free port, then re-run."
        exit 1
    fi
fi

# Initialize database BEFORE the backend build.
# Next.js evaluates module-level code during 'next build' page data collection,
# so DB tables must exist or the build fails with "no such table".
echo "Initializing database..."
cd "$BACKEND_DIR"
if [ -f "$DB_PATH" ]; then
    echo "✓ Database already exists — skipping seed (re-install, data preserved)"
else
    if ! pnpm "$DB_INIT_SCRIPT"; then
        echo "❌ Database initialization failed"
        exit 1
    fi
    echo "✓ Database initialized"
fi
echo ""

# Build backend (after .env is configured and database exists)
# Run from BACKEND_DIR (not PROJECT_ROOT) so pnpm executes only the backend
# build script rather than triggering turbo's full pipeline, which would run
# backend + mobile in parallel and exhaust memory on low-RAM devices.
echo "Building backend..."
cd "$BACKEND_DIR"
if ! pnpm build; then
    echo "❌ Backend build failed"
    exit 1
fi
echo "✓ Backend built"
echo ""

# Build mobile app (if configured)
if [ "$HAS_MOBILE_APP" = true ]; then
    echo "Building mobile web app..."
    cd "$PROJECT_ROOT"
    if ! pnpm --filter mobile build; then
        echo "❌ Mobile app build failed"
        exit 1
    fi
    echo "✓ Mobile web app built → $PROJECT_ROOT/$MOBILE_BUILD_DIR"
    echo ""
fi

remove_swap

# Ask if user wants to enable HTTPS with Caddy
echo "================================================"
echo "HTTPS Configuration (Optional)"
echo "================================================"
echo ""
echo "Would you like to enable HTTPS using Caddy?"
echo "This provides free automatic SSL certificates via Let's Encrypt."
echo ""
echo "Prerequisites:"
echo "  - You have a domain name pointing to this server"
echo "  - Ports 80 and 443 are forwarded to this server"
echo ""
read -p "Enable HTTPS? (y/N): " -n 1 -r
echo ""
ENABLE_HTTPS=false
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ENABLE_HTTPS=true

    echo ""
    read -p "Enter your domain name [$DEFAULT_DOMAIN]: " DOMAIN_NAME
    DOMAIN_NAME=${DOMAIN_NAME:-$DEFAULT_DOMAIN}

    if [ -z "$DOMAIN_NAME" ]; then
        echo "❌ Domain name is required for HTTPS. Skipping HTTPS setup."
        ENABLE_HTTPS=false
    else
        if ! echo "$DOMAIN_NAME" | grep -qE '^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'; then
            echo "❌ Invalid domain name format: $DOMAIN_NAME"
            echo "   Domain should be like: example.com or subdomain.example.com"
            ENABLE_HTTPS=false
        fi
    fi
fi
echo ""

# Create systemd service file
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
SERVICE_CREATED=true

echo "Creating systemd service..."
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=$APP_DISPLAY_NAME Backend Service
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$BACKEND_DIR
Environment="NODE_ENV=production"
Environment="PATH=/usr/bin:/usr/local/bin:$HOME/.local/share/pnpm"
ExecStart=$(which pnpm) start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

[Install]
WantedBy=multi-user.target
EOF

echo "✓ Systemd service file created at $SERVICE_FILE"
echo ""

# Reload systemd, enable and start (or restart) the service
echo "Configuring systemd service..."
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"

if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "Service already running, restarting..."
    sudo systemctl restart "$SERVICE_NAME"
else
    sudo systemctl start "$SERVICE_NAME"
fi
echo "✓ Service enabled and started"
echo ""

# Wait for service to start (with timeout)
echo "Waiting for service to start..."
MAX_WAIT=30
COUNT=0
while [ $COUNT -lt $MAX_WAIT ]; do
    if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
        echo "✓ Service is running (started in ${COUNT}s)"
        sudo systemctl status "$SERVICE_NAME" --no-pager -l
        break
    fi
    sleep 1
    COUNT=$((COUNT + 1))

    if [ $COUNT -eq $MAX_WAIT ]; then
        echo "❌ Service failed to start within ${MAX_WAIT} seconds"
        echo ""
        echo "Service status:"
        sudo systemctl status "$SERVICE_NAME" --no-pager -l
        echo ""
        echo "Recent logs:"
        sudo journalctl -u "$SERVICE_NAME" -n 50 --no-pager
        exit 1
    fi
done
echo ""

# Get port from .env file
PORT=$(grep -E '^PORT=' "$BACKEND_DIR/.env" | cut -d '=' -f 2 | tr -d '"' || echo "3000")

# Configure firewall to allow application port
echo "Configuring firewall for application access..."

if [ "$INSTALL_CADDY" = true ]; then
    # Caddy is the public entry point — the backend port must NOT be open to the
    # internet (Caddy proxies to it locally). Only 80/443 need to be reachable.
    echo "Caddy is installed — backend port $PORT is localhost-only (not opening in firewall)."
    echo "Ports 80 and 443 were already allowed during firewall setup above."
elif command -v ufw &> /dev/null && sudo ufw status | grep -q "Status: active"; then
    echo "Detected active UFW firewall"
    echo "Allowing backend port $PORT (no Caddy — direct access)..."

    if ! sudo ufw status | grep -q "$PORT/tcp"; then
        sudo ufw allow $PORT/tcp
        echo "✓ Firewall rule added (ufw allow $PORT/tcp)"
    else
        echo "✓ Firewall rule already exists for port $PORT"
    fi

    echo ""
    echo "Current firewall status:"
    sudo ufw status numbered
elif command -v iptables &> /dev/null; then
    echo "⚠️  UFW not active. Falling back to iptables configuration."

    for port in $PORT; do
        if ! sudo iptables -C INPUT -p tcp --dport $port -j ACCEPT 2>/dev/null; then
            sudo iptables -A INPUT -p tcp --dport $port -j ACCEPT
            echo "✓ Firewall rule added (iptables -A INPUT -p tcp --dport $port -j ACCEPT)"
        else
            echo "✓ Firewall rule already exists for port $port"
        fi
    done

    if command -v iptables-save &> /dev/null; then
        sudo sh -c "iptables-save > /etc/iptables/rules.v4" 2>/dev/null || true
        echo "✓ iptables rules saved"
    fi
else
    echo "⚠️  No firewall detected or configured."
    echo "   For security, consider enabling UFW:"
    echo "   1. sudo ufw allow 22/tcp"
    echo "   2. sudo ufw allow $PORT/tcp"
    echo "   3. sudo ufw enable"
fi
echo ""

# Install and configure Caddy
# For apps with a mobile SPA, Caddy is always installed (not optional) since it
# is needed to route / → static files and /api + /admin → Next.js backend.
# For backend-only apps, Caddy is only installed when HTTPS is requested.
INSTALL_CADDY=false
if [ "$HAS_MOBILE_APP" = true ] || [ "$ENABLE_HTTPS" = true ]; then
    INSTALL_CADDY=true
fi

if [ "$INSTALL_CADDY" = true ]; then
    echo "================================================"
    echo "Installing Caddy"
    echo "================================================"
    echo ""

    if command -v caddy &> /dev/null; then
        echo "✓ Caddy is already installed ($(caddy version))"
    else
        echo "Installing Caddy..."

        sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
        sudo apt update
        sudo apt install -y caddy

        echo "✓ Caddy installed"
    fi
    echo ""

    # Use per-app config file under conf.d/ — never overwrite the whole Caddyfile
    sudo mkdir -p /etc/caddy/conf.d

    # Add import directive to Caddyfile only if not already present
    if ! grep -q "import /etc/caddy/conf.d" /etc/caddy/Caddyfile 2>/dev/null; then
        echo "" | sudo tee -a /etc/caddy/Caddyfile > /dev/null
        echo "import /etc/caddy/conf.d/*.caddy" | sudo tee -a /etc/caddy/Caddyfile > /dev/null
        echo "✓ Added import directive to /etc/caddy/Caddyfile"
    else
        echo "✓ /etc/caddy/Caddyfile already has import directive"
    fi

    # Determine the listen address
    if [ "$ENABLE_HTTPS" = true ]; then
        CADDY_LISTEN="$DOMAIN_NAME"
    else
        CADDY_LISTEN=":80"
    fi

    # Create log directory
    sudo mkdir -p /var/log/caddy
    sudo chown caddy:caddy /var/log/caddy 2>/dev/null || true

    # Remove any legacy inline site block for this domain from the main Caddyfile.
    # Old installs wrote the block directly into Caddyfile; now we keep it in conf.d/.
    # Having it in both places causes "ambiguous site definition" on reload.
    if sudo grep -qE "^${CADDY_LISTEN//./\\.}[[:space:]]*\{|^${CADDY_LISTEN//./\\.}\{" /etc/caddy/Caddyfile 2>/dev/null; then
        echo "Found legacy inline '$CADDY_LISTEN' block in Caddyfile — removing (migrating to conf.d/)..."
        TMPPY=$(mktemp /tmp/caddy_clean_XXXXXX.py)
        cat > "$TMPPY" <<'PYEOF'
import sys, re
target, path = sys.argv[1], sys.argv[2]
with open(path) as f:
    lines = f.readlines()
result, skip, depth = [], False, 0
for line in lines:
    s = line.strip()
    if not skip and re.match(re.escape(target) + r'\s*\{', s):
        skip, depth = True, s.count('{') - s.count('}')
        continue
    if skip:
        depth += s.count('{') - s.count('}')
        if depth <= 0:
            skip = False
        continue
    result.append(line)
with open(path, 'w') as f:
    f.writelines(result)
PYEOF
        sudo python3 "$TMPPY" "$CADDY_LISTEN" /etc/caddy/Caddyfile
        rm -f "$TMPPY"
        echo "✓ Legacy inline block removed from Caddyfile"
    fi

    # Write app-specific Caddy config
    APP_CADDY_FILE="/etc/caddy/conf.d/$APP_SLUG.caddy"
    echo "Writing Caddy config to $APP_CADDY_FILE ..."

    if [ "$HAS_MOBILE_APP" = true ]; then
        # Mobile SPA app: route /api/* and /admin* to Next.js; serve SPA for everything else
        MOBILE_BUILD_PATH="$PROJECT_ROOT/$MOBILE_BUILD_DIR"
        sudo tee "$APP_CADDY_FILE" > /dev/null <<EOF
# $APP_DISPLAY_NAME - generated by pi-deploy install.sh
$CADDY_LISTEN {
    # API and admin portal → Next.js backend
    handle /api/* {
        reverse_proxy localhost:$PORT
    }
    handle /admin* {
        reverse_proxy localhost:$PORT
    }

    # Mobile SPA (catch-all) — static files with SPA fallback
    handle {
        root * $MOBILE_BUILD_PATH
        try_files {path} /index.html
        file_server
    }

    encode gzip

    header {
        Strict-Transport-Security "max-age=15552000; includeSubDomains"
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
    }

    log {
        output file /var/log/caddy/${CADDY_LOG_NAME}-access.log {
            roll_size 10mb
            roll_keep 5
        }
    }
}
EOF
    else
        # Backend-only app: simple reverse proxy
        sudo tee "$APP_CADDY_FILE" > /dev/null <<EOF
# $APP_DISPLAY_NAME - generated by pi-deploy install.sh
$CADDY_LISTEN {
    reverse_proxy localhost:$PORT

    encode gzip

    header {
        Strict-Transport-Security "max-age=15552000; includeSubDomains"
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
    }

    log {
        output file /var/log/caddy/${CADDY_LOG_NAME}-access.log {
            roll_size 10mb
            roll_keep 5
        }
    }
}
EOF
    fi

    echo "✓ Caddy config written to $APP_CADDY_FILE"
    echo ""

    # Validate config before touching the live service — surfaces syntax errors
    echo "Validating Caddy config..."
    if ! sudo caddy validate --config /etc/caddy/Caddyfile 2>&1; then
        echo ""
        echo "⚠️  Caddy config validation failed (see above). Skipping Caddy reload."
        echo "   Fix $APP_CADDY_FILE, then run: sudo systemctl reload caddy"
        CADDY_STARTED=false
    else
        echo "✓ Caddy config valid"
        echo ""

        # Enable and reload/start Caddy — use || true so a Caddy failure does NOT
        # abort the install via set -e; the CADDY_STARTED check below handles it.
        sudo systemctl enable caddy

        if sudo systemctl is-active --quiet caddy; then
            echo "Reloading Caddy config..."
            sudo systemctl reload caddy || true
        else
            echo "Starting Caddy service..."
            sudo systemctl start caddy || true
        fi
    fi

    # Wait for Caddy to start (with timeout)
    MAX_WAIT=10
    COUNT=0
    CADDY_STARTED=false
    while [ $COUNT -lt $MAX_WAIT ]; do
        if sudo systemctl is-active --quiet caddy; then
            echo "✓ Caddy is running (started in ${COUNT}s)"
            CADDY_STARTED=true
            break
        fi
        sleep 1
        COUNT=$((COUNT + 1))
    done

    if [ "$CADDY_STARTED" = false ]; then
        echo "⚠️  Caddy failed to start within ${MAX_WAIT} seconds"
        echo ""
        echo "Caddy status:"
        sudo systemctl status caddy --no-pager -l
        echo ""
        echo "Recent logs:"
        sudo journalctl -u caddy -n 50 --no-pager
        echo ""
        echo "⚠️  Caddy setup incomplete. Backend still accessible on port $PORT."
        echo "   Check logs and $APP_CADDY_FILE configuration."
    fi
    echo ""
fi

# Optional Samba installation
echo ""
read -p "Install Samba for network file access from Windows? (y/N): " -n 1 -r
echo ""
INSTALL_SAMBA=false
if [[ $REPLY =~ ^[Yy]$ ]]; then
    INSTALL_SAMBA=true

    echo "================================================"
    echo "Installing Samba"
    echo "================================================"
    echo ""

    if command -v smbd &> /dev/null; then
        echo "✓ Samba is already installed"
    else
        echo "Installing Samba..."
        sudo apt-get update
        sudo apt-get install -y samba samba-common-bin
        echo "✓ Samba installed"
    fi

    SAMBA_CONF="/etc/samba/smb.conf"

    if [ ! -f "$SAMBA_CONF.backup" ]; then
        sudo cp "$SAMBA_CONF" "$SAMBA_CONF.backup"
        echo "✓ Samba config backed up"
    fi

    echo ""
    echo "Configuring Samba shares..."

    # Share: project files (read-write)
    if ! grep -q "\[$APP_SLUG\]" "$SAMBA_CONF"; then
        sudo tee -a "$SAMBA_CONF" > /dev/null <<EOF

# $APP_DISPLAY_NAME Application Files (read-write)
[$APP_SLUG]
    comment = $APP_DISPLAY_NAME Application Files
    path = $PROJECT_ROOT
    browseable = yes
    read only = no
    create mask = 0644
    directory mask = 0755
    valid users = $CURRENT_USER
EOF
        echo "✓ $APP_SLUG share configured (read-write)"
    else
        echo "✓ $APP_SLUG share already exists"
    fi

    # Share: system logs (read-only)
    if ! grep -q "\[logs\]" "$SAMBA_CONF"; then
        sudo usermod -a -G adm "$CURRENT_USER"
        sudo tee -a "$SAMBA_CONF" > /dev/null <<EOF

# System and Application Logs (read-only)
[logs]
    comment = System and Application Logs
    path = /var/log
    browseable = yes
    read only = yes
    valid users = $CURRENT_USER
EOF
        echo "✓ logs share configured (read-only)"
        echo "  Note: Log out and back in for group permissions to take effect"
    else
        echo "✓ logs share already exists"
    fi

    # Share: Caddy config (if Caddy was installed)
    CONFIGURE_CADDY_SHARE=false
    if [ "$INSTALL_CADDY" = true ]; then
        if ! grep -q "\[caddy-config\]" "$SAMBA_CONF"; then
            CONFIGURE_CADDY_SHARE=true
            sudo tee -a "$SAMBA_CONF" > /dev/null <<EOF

# Caddy Configuration Files (read-write)
[caddy-config]
    comment = Caddy Reverse Proxy Configuration
    path = /etc/caddy
    browseable = yes
    read only = no
    create mask = 0644
    directory mask = 0755
    valid users = $CURRENT_USER
EOF
            echo "✓ caddy-config share configured (read-write)"
        else
            echo "✓ caddy-config share already exists"
        fi
    fi

    # Set Samba password
    echo ""
    echo "Set Samba password for user '$CURRENT_USER':"
    echo "(This can be the same as your Linux password for convenience)"
    echo ""

    if ! sudo pdbedit -L | grep -q "^$CURRENT_USER:"; then
        sudo smbpasswd -a "$CURRENT_USER"
    else
        echo "Samba user '$CURRENT_USER' already exists."
        read -p "Reset Samba password? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo smbpasswd "$CURRENT_USER"
        fi
    fi

    sudo smbpasswd -e "$CURRENT_USER"
    echo ""
    echo "✓ Samba user configured"

    if [ "$CONFIGURE_CADDY_SHARE" = true ]; then
        sudo chown -R caddy:"$CURRENT_USER" /etc/caddy 2>/dev/null || true
        sudo chmod -R g+w /etc/caddy 2>/dev/null || true
        echo "✓ Caddy directory permissions updated for Samba access"
    fi

    sudo systemctl restart smbd
    sudo systemctl enable smbd
    sudo systemctl restart nmbd 2>/dev/null || true
    sudo systemctl enable nmbd 2>/dev/null || true
    echo "✓ Samba services started"

    if command -v ufw &> /dev/null && sudo ufw status | grep -q "Status: active"; then
        if ! sudo ufw status | grep -q "Samba"; then
            sudo ufw allow Samba
            echo "✓ Firewall configured for Samba"
        else
            echo "✓ Samba firewall rules already exist"
        fi
    fi

    SERVER_IP=$(hostname -I | awk '{print $1}')

    echo ""
    echo "================================================"
    echo "Samba Network Access Configured"
    echo "================================================"
    echo ""
    echo "From Windows File Explorer, access:"
    echo "  \\\\$SERVER_IP\\$APP_SLUG       (Application files - read/write)"
    echo "  \\\\$SERVER_IP\\logs              (System logs - read-only)"
    if [ "$INSTALL_CADDY" = true ]; then
        echo "  \\\\$SERVER_IP\\caddy-config      (Caddy config - read/write)"
    fi
    echo ""
    echo "Username: $CURRENT_USER"
    echo "Password: (the Samba password you just set)"
    echo ""
    echo "Tip: In Windows, map as a network drive:"
    echo "     Right-click 'This PC' → 'Map network drive'"
    echo ""
fi

# Install shared scripts system-wide (bootstrap)
echo "================================================"
echo "Installing Shared Deploy Scripts"
echo "================================================"
echo ""
DEPLOY_LIB="/usr/local/lib/pi-deploy"
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SELF_DIR/install.sh" ] && [ -f "$SELF_DIR/update.sh" ]; then
    sudo mkdir -p "$DEPLOY_LIB"
    sudo cp "$SELF_DIR/install.sh" "$DEPLOY_LIB/install.sh"
    sudo cp "$SELF_DIR/update.sh"  "$DEPLOY_LIB/update.sh"
    sudo chmod +x "$DEPLOY_LIB/install.sh" "$DEPLOY_LIB/update.sh"
    sudo ln -sf "$DEPLOY_LIB/install.sh" /usr/local/bin/pi-app-install
    sudo ln -sf "$DEPLOY_LIB/update.sh"  /usr/local/bin/pi-app-update
    echo "✓ pi-app-install and pi-app-update installed system-wide"
    echo "  Use these to install additional apps on this Pi:"
    echo "  pi-app-install ~/other-app/apps/backend/scripts/deploy.config.sh"
else
    echo "⚠️  Could not find install.sh/update.sh next to this script — skipping bootstrap."
fi
echo ""

# Display useful commands
echo "================================================"
echo "Installation Complete!"
echo "================================================"
echo ""
echo "The backend service is now running and will start automatically on boot."
echo ""

if [ "$INSTALL_CADDY" = true ] && [ "$ENABLE_HTTPS" = true ]; then
    echo "HTTPS Configuration:"
    echo "  Domain: https://$DOMAIN_NAME"
    echo "  Certificate: Automatic (Let's Encrypt)"
    echo "  Renewal: Automatic (handled by Caddy)"
    echo ""
    echo "⚠️  IMPORTANT: Ensure your domain's DNS is configured correctly"
    echo "   and ports 80/443 are forwarded to this server."
    echo ""
    echo "Caddy commands:"
    echo "  sudo systemctl status caddy        # Check Caddy status"
    echo "  sudo systemctl restart caddy       # Restart Caddy"
    echo "  sudo journalctl -u caddy -f        # View Caddy logs"
    echo "  caddy validate --config /etc/caddy/Caddyfile  # Test config"
    echo ""
    if [ "$HAS_MOBILE_APP" = true ]; then
        echo "App accessible at:"
        echo "  https://$DOMAIN_NAME           (mobile web app)"
        echo "  https://$DOMAIN_NAME/admin     (admin portal)"
        echo "  https://$DOMAIN_NAME/api/...   (API)"
    else
        echo "App accessible at:"
        echo "  https://$DOMAIN_NAME"
        echo "  https://$DOMAIN_NAME/admin     (admin portal)"
    fi
elif [ "$INSTALL_CADDY" = true ]; then
    echo "Caddy is running on :80 (HTTP)."
    if [ "$HAS_MOBILE_APP" = true ]; then
        SERVER_IP=$(hostname -I | awk '{print $1}')
        echo ""
        echo "App accessible at:"
        echo "  http://$SERVER_IP              (mobile web app)"
        echo "  http://$SERVER_IP/admin        (admin portal)"
        echo "  http://$SERVER_IP/api/...      (API)"
    fi
else
    echo "Firewall configured to allow network access on port $PORT."
    echo ""
    echo "App accessible at:"
    echo "  Local:   http://localhost:$PORT"
    echo "  Network: http://$(hostname -I | awk '{print $1}'):$PORT"
    echo "  Admin:   http://localhost:$PORT/admin"
fi
echo ""

echo "Backend service commands:"
echo "  sudo systemctl status $SERVICE_NAME    # Check status"
echo "  sudo systemctl restart $SERVICE_NAME   # Restart"
echo "  sudo systemctl stop $SERVICE_NAME      # Stop"
echo "  sudo systemctl start $SERVICE_NAME     # Start"
echo "  sudo journalctl -u $SERVICE_NAME -f    # Live logs"
echo "  sudo journalctl -u $SERVICE_NAME -n 100  # Last 100 log lines"
echo ""
echo "After making code or .env changes:"
echo "  Run: cd $PROJECT_ROOT && ./apps/backend/scripts/update.sh"
echo "  Or:  pi-app-update $CONFIG_FILE"
echo ""
echo "Environment file: $BACKEND_DIR/.env"
echo "Database:         $BACKEND_DIR/database.db"
if [ "$INSTALL_CADDY" = true ]; then
    echo "Caddy site config: /etc/caddy/conf.d/$APP_SLUG.caddy"
    echo "Caddy access log:  /var/log/caddy/${CADDY_LOG_NAME}-access.log"
fi
echo ""

echo "================================================"
echo "Firewall Configuration"
echo "================================================"
echo ""
if command -v ufw &> /dev/null && sudo ufw status | grep -q "Status: active"; then
    echo "UFW Firewall Status:"
    sudo ufw status numbered | head -n 10
    echo ""
    echo "UFW commands:"
    echo "  sudo ufw status numbered         # View all firewall rules"
    echo "  sudo ufw allow <port>/tcp        # Allow a port"
    echo "  sudo ufw delete <rule-number>    # Remove a rule"
    echo "  sudo ufw disable                 # Disable firewall (not recommended)"
    echo "  sudo ufw enable                  # Enable firewall"
    echo ""
    echo "⚠️  Important: Port 22 (SSH) is allowed to prevent lockout."
    echo "   Do not remove this rule unless using another access method."
else
    echo "⚠️  UFW firewall is not active."
    echo "   For security, consider enabling it:"
    echo "   1. sudo ufw allow 22/tcp"
    echo "   2. sudo ufw enable"
fi

if [ "$INSTALL_SAMBA" = true ]; then
    echo ""
    echo "================================================"
    echo "Network File Access (Samba)"
    echo "================================================"
    echo ""
    echo "From Windows:"
    echo "  1. Open File Explorer"
    echo "  2. In address bar: \\\\$SERVER_IP"
    echo "  3. Enter credentials when prompted"
    echo ""
    echo "Available shares:"
    echo "  \\\\$SERVER_IP\\$APP_SLUG       (read/write)"
    echo "  \\\\$SERVER_IP\\logs              (read-only)"
    if [ "$INSTALL_CADDY" = true ]; then
        echo "  \\\\$SERVER_IP\\caddy-config      (read/write)"
    fi
    echo ""
    echo "Username: $CURRENT_USER"
    echo ""
    echo "Samba commands:"
    echo "  sudo systemctl status smbd       # Check Samba status"
    echo "  sudo systemctl restart smbd      # Restart Samba"
    echo "  sudo smbpasswd $CURRENT_USER     # Change Samba password"
    echo "  sudo nano /etc/samba/smb.conf    # Edit Samba config"
fi

echo ""

# Make update script executable
chmod +x "$CONFIG_DIR/update.sh" 2>/dev/null || true

echo ""
echo "================================================"
echo "Database Inspection Guide (SQLite3)"
echo "================================================"
echo ""
echo "To inspect the database, use sqlite3 CLI:"
echo ""
echo "1. Open the database:"
echo "   sqlite3 $BACKEND_DIR/database.db"
echo ""
echo "2. Common commands (run inside sqlite3):"
echo "   .tables                      # List all tables"
echo "   .schema <table>              # Show table schema"
echo "   .headers on                  # Enable column headers"
echo "   .mode column                 # Column-aligned output"
echo "   .quit                        # Exit sqlite3"
echo ""
echo "3. Useful queries:"
echo "   SELECT COUNT(*) FROM users;"
echo "   SELECT id, email FROM users;"
echo "   SELECT * FROM refresh_tokens LIMIT 10;"
echo ""
echo "Quick one-liner:"
echo "   sqlite3 $BACKEND_DIR/database.db 'SELECT email FROM users;'"
echo ""
echo "================================================"
echo ""

# Disable cleanup trap on successful completion
trap - EXIT

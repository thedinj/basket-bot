#!/bin/bash
set -e

# ==============================================================================
# BASKET BOT BACKEND INSTALLATION SCRIPT
# ==============================================================================
# For Raspberry Pi Raspbian - Run as admin user
#
# PREREQUISITES - Getting the code onto your server:
# ------------------------------------------------------------------------------
# 1. SSH into your Raspberry Pi as the admin user:
#    ssh admin@your-pi-hostname
#
# 2. Install Node.js (v18 or higher) if not already installed:
#    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
#    sudo apt-get install -y nodejs
#    # Verify installation: node --version && npm --version
#
# 3. Navigate to your home directory (recommended location):
#    cd ~
#    # This takes you to /home/admin (typical for admin user on Raspbian)
#    # You can clone to any directory you have write permissions for
#    # Use 'pwd' to confirm your current location
#
# 4. Clone the repository from GitHub:
#    git clone https://github.com/thedinj/basket-bot.git
#    # This creates a new directory: ~/basket-bot
#
#    OR, if you've already cloned it, navigate into it and update to latest:
#    cd ~/basket-bot
#    git pull origin main
#
# 5. Navigate to the backend scripts directory:
#    cd ~/basket-bot/apps/backend/scripts
#    # Or if you're already in ~/basket-bot: cd apps/backend/scripts
#
# 6. Make this script executable (if not already):
#    chmod +x install.sh
#
# 7. Run this installation script:
#    ./install.sh
#
# WHAT THIS SCRIPT DOES:
# ------------------------------------------------------------------------------
# - Installs dependencies (pnpm, Node.js packages)
# - Builds the backend application
# - Sets up the SQLite database
# - Configures systemd service for auto-start on boot
# - Optionally configures HTTPS with Caddy reverse proxy
# ==============================================================================

echo "================================================"
echo "Basket Bot Backend Installation"
echo "================================================"
echo ""

# Get the absolute path to the project root (2 levels up from scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/apps/backend"

echo "Project root: $PROJECT_ROOT"
echo "Backend directory: $BACKEND_DIR"
echo ""

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

    # Check if npm is available
    if ! command -v npm &> /dev/null; then
        echo "❌ npm is not installed. Please install Node.js first:"
        echo "   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
        echo "   sudo apt-get install -y nodejs"
        echo ""
        echo "   Then verify installation:"
        echo "   node --version && npm --version"
        exit 1
    fi

    sudo npm install -g pnpm
else
    echo "✓ pnpm is already installed ($(pnpm --version))"
fi
echo ""

# Check if Node.js is installed (v18 or higher recommended)
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

# Navigate to project root
cd "$PROJECT_ROOT"

# Install dependencies
echo "Installing dependencies..."
pnpm install
echo "✓ Dependencies installed"
echo ""

# Build core package
echo "Building core package..."
pnpm --filter @basket-bot/core build
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

    # Ensure production environment
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

# Build backend (after .env is configured)
echo "Building backend..."
pnpm build
echo "✓ Backend built"
echo ""

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

    # Get domain name
    echo ""
    read -p "Enter your domain name [basketbot.ddns.net]: " DOMAIN_NAME
    DOMAIN_NAME=${DOMAIN_NAME:-basketbot.ddns.net}

    if [ -z "$DOMAIN_NAME" ]; then
        echo "❌ Domain name is required for HTTPS. Skipping HTTPS setup."
        ENABLE_HTTPS=false
    fi
fi
echo ""

# Initialize database
echo "Initializing database..."
pnpm db:init
echo "✓ Database initialized"
echo ""

# Create systemd service file
SERVICE_NAME="basket-bot-backend"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"

echo "Creating systemd service..."
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Basket Bot Backend Service
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

# Reload systemd, enable and start the service
echo "Configuring systemd service..."
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl start "$SERVICE_NAME"
echo "✓ Service enabled and started"
echo ""

# Check service status
echo "Checking service status..."
sleep 2
if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "✓ Service is running"
    sudo systemctl status "$SERVICE_NAME" --no-pager -l
else
    echo "❌ Service failed to start. Checking logs..."
    sudo journalctl -u "$SERVICE_NAME" -n 50 --no-pager
    exit 1
fi
echo ""

# Get port from .env file
PORT=$(grep -E '^PORT=' "$BACKEND_DIR/.env" | cut -d '=' -f 2 | tr -d '"' || echo "3000")

# Configure firewall to allow access from network
if [ "$ENABLE_HTTPS" = true ]; then
    echo "Configuring firewall for HTTPS (ports 80, 443)..."
    FIREWALL_PORTS="80 443"
else
    echo "Configuring firewall for port $PORT..."
    FIREWALL_PORTS="$PORT"
fi

if command -v ufw &> /dev/null; then
    echo "Detected ufw firewall"
    for port in $FIREWALL_PORTS; do
        sudo ufw allow $port/tcp
        echo "✓ Firewall rule added (ufw allow $port/tcp)"
    done
elif command -v iptables &> /dev/null; then
    echo "Detected iptables firewall"
    for port in $FIREWALL_PORTS; do
        # Check if rule already exists
        if ! sudo iptables -C INPUT -p tcp --dport $port -j ACCEPT 2>/dev/null; then
            sudo iptables -A INPUT -p tcp --dport $port -j ACCEPT
            echo "✓ Firewall rule added (iptables -A INPUT -p tcp --dport $port -j ACCEPT)"
        else
            echo "✓ Firewall rule already exists for port $port"
        fi
    done
    # Save iptables rules (method varies by distro)
    if command -v iptables-save &> /dev/null; then
        sudo sh -c "iptables-save > /etc/iptables/rules.v4" 2>/dev/null || true
    fi
else
    echo "⚠️  No supported firewall detected (ufw/iptables)"
    echo "   If you need network access, manually allow port(s): $FIREWALL_PORTS"
fi
echo ""

# Install and configure Caddy if HTTPS is enabled
if [ "$ENABLE_HTTPS" = true ]; then
    echo "================================================"
    echo "Installing Caddy"
    echo "================================================"
    echo ""

    # Check if Caddy is already installed
    if command -v caddy &> /dev/null; then
        echo "✓ Caddy is already installed ($(caddy version))"
    else
        echo "Installing Caddy..."

        # Install dependencies
        sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl

        # Add Caddy repository
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list

        # Install Caddy
        sudo apt update
        sudo apt install -y caddy

        echo "✓ Caddy installed"
    fi
    echo ""

    # Create Caddyfile
    echo "Creating Caddyfile..."
    CADDYFILE="/etc/caddy/Caddyfile"

    sudo tee "$CADDYFILE" > /dev/null <<EOF
# Basket Bot Backend - Automatic HTTPS
$DOMAIN_NAME {
    # Reverse proxy to Next.js backend
    reverse_proxy localhost:$PORT

    # Enable gzip compression
    encode gzip

    # Security headers
    header {
        # Enable HSTS (6 months)
        Strict-Transport-Security "max-age=15552000; includeSubDomains"
        # Prevent clickjacking
        X-Frame-Options "SAMEORIGIN"
        # Prevent MIME sniffing
        X-Content-Type-Options "nosniff"
        # Enable XSS filter
        X-XSS-Protection "1; mode=block"
    }

    # Log access
    log {
        output file /var/log/caddy/basketbot-access.log {
            roll_size 10mb
            roll_keep 5
        }
    }
}
EOF

    echo "✓ Caddyfile created at $CADDYFILE"
    echo ""

    # Create log directory
    sudo mkdir -p /var/log/caddy
    sudo chown caddy:caddy /var/log/caddy

    # Enable and start Caddy
    echo "Starting Caddy service..."
    sudo systemctl enable caddy
    sudo systemctl restart caddy

    # Check Caddy status
    sleep 2
    if sudo systemctl is-active --quiet caddy; then
        echo "✓ Caddy is running"
    else
        echo "❌ Caddy failed to start. Checking logs..."
        sudo journalctl -u caddy -n 50 --no-pager
        echo ""
        echo "⚠️  HTTPS setup incomplete. Backend is still accessible on port $PORT."
        echo "   Check logs and Caddyfile configuration."
    fi
    echo ""
fi

# Display useful commands
echo "================================================"
echo "Installation Complete!"
echo "================================================"
echo ""
echo "The backend service is now running and will start automatically on boot."

if [ "$ENABLE_HTTPS" = true ]; then
    echo ""
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
    echo "Test HTTPS:"
    echo "  curl -I https://$DOMAIN_NAME"
    echo ""
    echo "Update mobile app configuration:"
    echo "  Edit apps/mobile/.env and set:"
    echo "  VITE_API_BASE_URL=https://$DOMAIN_NAME"
else
    echo "Firewall configured to allow network access on port $PORT."
fi
echo ""
echo "Backend service commands:"
echo "  sudo systemctl status $SERVICE_NAME    # Check service status"
echo "  sudo systemctl restart $SERVICE_NAME   # Restart service"
echo "  sudo systemctl stop $SERVICE_NAME      # Stop service"
echo "  sudo systemctl start $SERVICE_NAME     # Start service"
echo "  sudo journalctl -u $SERVICE_NAME -f   # View live logs"
echo "  sudo journalctl -u $SERVICE_NAME -n 100  # View last 100 log lines"
echo ""
echo "After making changes to code or .env:"
echo "  1. Rebuild: cd $BACKEND_DIR && pnpm build"
echo "  2. Restart: sudo systemctl restart $SERVICE_NAME"
echo ""

if [ "$ENABLE_HTTPS" = true ]; then
    echo "Backend accessible at:"
    echo "  HTTPS:   https://$DOMAIN_NAME"
    echo "  Local:   http://localhost:$PORT"
    echo ""
    echo "Admin portal:"
    echo "  https://$DOMAIN_NAME/admin"
else
    echo "Backend should be accessible at:"
    echo "  Local:   http://localhost:$PORT"
    echo "  Network: http://$(hostname -I | awk '{print $1}'):$PORT"
    echo ""
    echo "Admin portal:"
    echo "  http://localhost:$PORT/admin"
fi

echo ""
echo "Environment file location: $BACKEND_DIR/.env"
echo "Database location: $BACKEND_DIR/database.db"

if [ "$ENABLE_HTTPS" = true ]; then
    echo "Caddyfile location: /etc/caddy/Caddyfile"
    echo "Caddy logs: /var/log/caddy/basketbot-access.log"
    echo ""
    echo "For detailed HTTPS setup documentation, see:"
    echo "  $PROJECT_ROOT/docs/HTTPS_SETUP.md"
fi

echo ""

# Make update script executable
chmod +x "$BACKEND_DIR/scripts/update.sh"

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
echo "   .schema User                 # Show User table schema"
echo "   .schema                      # Show schema for all tables"
echo "   .headers on                  # Enable column headers"
echo "   .mode column                 # Enable column-aligned output"
echo ""
echo "3. Query examples:"
echo "   SELECT COUNT(*) FROM User;                    # Count total users"
echo "   SELECT id, email, name FROM User;             # List all users"
echo "   SELECT * FROM User WHERE email LIKE '%admin%'; # Find admin users"
echo "   SELECT COUNT(*) FROM Store;                   # Count stores"
echo "   SELECT * FROM Household;                      # View all households"
echo "   SELECT * FROM RefreshToken;                   # View active tokens"
echo ""
echo "4. Exit sqlite3:"
echo "   .quit"
echo ""
echo "Quick one-liner examples (no need to enter sqlite3 shell):"
echo "   sqlite3 $BACKEND_DIR/database.db 'SELECT COUNT(*) FROM User;'"
echo "   sqlite3 $BACKEND_DIR/database.db 'SELECT email, name FROM User;'"
echo ""
echo "================================================"
echo ""

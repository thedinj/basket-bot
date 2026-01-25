#!/bin/bash
set -e

# Basket Bot Backend Installation Script
# For Raspberry Pi Raspbian - Run as admin user
# This script installs dependencies, sets up the database, and configures systemd service

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
    npm install -g pnpm
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

# Build backend
echo "Building backend..."
cd "$BACKEND_DIR"
pnpm build
echo "✓ Backend built"
echo ""

# Set up environment file
echo "Setting up environment file..."
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "Creating .env from .env.example..."
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"

    # Generate a random JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i "s|JWT_SECRET=\"your-secret-key-change-this-in-production\"|JWT_SECRET=\"$JWT_SECRET\"|g" "$BACKEND_DIR/.env"

    # Set production environment
    sed -i 's|NODE_ENV="development"|NODE_ENV="production"|g' "$BACKEND_DIR/.env"

    # Set database path to production location
    sed -i 's|DATABASE_URL="file:./dev.db"|DATABASE_URL="file:./production.db"|g' "$BACKEND_DIR/.env"

    echo "✓ .env file created with random JWT secret"
    echo ""
    echo "⚠️  IMPORTANT: Please edit $BACKEND_DIR/.env and update:"
    echo "   - ADMIN_EMAIL"
    echo "   - ADMIN_NAME"
    echo "   - ADMIN_PASSWORD"
    echo ""
    read -p "Press Enter after you've updated the .env file..."
else
    echo "✓ .env file already exists"
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
echo "Configuring firewall for port $PORT..."
if command -v ufw &> /dev/null; then
    echo "Detected ufw firewall"
    sudo ufw allow $PORT/tcp
    echo "✓ Firewall rule added (ufw allow $PORT/tcp)"
elif command -v iptables &> /dev/null; then
    echo "Detected iptables firewall"
    # Check if rule already exists
    if ! sudo iptables -C INPUT -p tcp --dport $PORT -j ACCEPT 2>/dev/null; then
        sudo iptables -A INPUT -p tcp --dport $PORT -j ACCEPT
        # Save iptables rules (method varies by distro)
        if command -v iptables-save &> /dev/null; then
            sudo sh -c "iptables-save > /etc/iptables/rules.v4" 2>/dev/null || true
        fi
        echo "✓ Firewall rule added (iptables -A INPUT -p tcp --dport $PORT -j ACCEPT)"
    else
        echo "✓ Firewall rule already exists"
    fi
else
    echo "⚠️  No supported firewall detected (ufw/iptables)"
    echo "   If you need network access, manually allow port $PORT"
fi
echo ""

# Display useful commands
echo "================================================"
echo "Installation Complete!"
echo "================================================"
echo ""
echo "The backend service is now running and will start automatically on boot."
echo "Firewall configured to allow network access on port $PORT."
echo ""
echo "Useful commands:"
echo "  sudo systemctl status $SERVICE_NAME    # Check service status"
echo "  sudo systemctl restart $SERVICE_NAME   # Restart service"
echo "  sudo systemctl stop $SERVICE_NAME      # Stop service"
echo "  sudo journalctl -u $SERVICE_NAME -f   # View live logs"
echo "  sudo journalctl -u $SERVICE_NAME -n 100  # View last 100 log lines"
echo ""
echo "Backend should be accessible at:"
echo "  Local:   http://localhost:$PORT"
echo "  Network: http://$(hostname -I | awk '{print $1}'):$PORT"
echo ""
echo "Admin portal:"
echo "  http://localhost:$PORT/admin"
echo ""
echo "Environment file location: $BACKEND_DIR/.env"
echo "Database location: $BACKEND_DIR/production.db"
echo ""

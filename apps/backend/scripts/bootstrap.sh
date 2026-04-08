#!/bin/bash
set -e

# ==============================================================================
# PI-DEPLOY BOOTSTRAP
# ==============================================================================
# Installs the generic install.sh and update.sh scripts system-wide on this Pi,
# making pi-app-install and pi-app-update available as commands.
#
# Run this once from the basket-bot repo (basket-bot is the canonical source for
# the shared deploy scripts). Safe to re-run — it just updates the installed copies.
#
# Usage:
#   cd ~/basket-bot/apps/backend/scripts
#   chmod +x bootstrap.sh && ./bootstrap.sh
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_LIB="/usr/local/lib/pi-deploy"

echo "================================================"
echo "Pi-Deploy Bootstrap"
echo "================================================"
echo ""
echo "Installing shared deploy scripts to $DEPLOY_LIB ..."
echo ""

sudo mkdir -p "$DEPLOY_LIB"
sudo cp "$SCRIPT_DIR/install.sh" "$DEPLOY_LIB/install.sh"
sudo cp "$SCRIPT_DIR/update.sh"  "$DEPLOY_LIB/update.sh"
sudo chmod +x "$DEPLOY_LIB/install.sh" "$DEPLOY_LIB/update.sh"

sudo ln -sf "$DEPLOY_LIB/install.sh" /usr/local/bin/pi-app-install
sudo ln -sf "$DEPLOY_LIB/update.sh"  /usr/local/bin/pi-app-update

echo "✓ Installed $DEPLOY_LIB/install.sh"
echo "✓ Installed $DEPLOY_LIB/update.sh"
echo "✓ Linked /usr/local/bin/pi-app-install"
echo "✓ Linked /usr/local/bin/pi-app-update"
echo ""
echo "Usage:"
echo "  pi-app-install ~/chance-a-maran/apps/backend/scripts/deploy.config.sh"
echo "  pi-app-update  ~/chance-a-maran/apps/backend/scripts/deploy.config.sh"
echo ""
echo "================================================"
echo "Bootstrap complete."
echo "================================================"

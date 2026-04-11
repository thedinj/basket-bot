#!/bin/bash
# ==============================================================================
# BASKET BOT - PI-DEPLOY CONFIGURATION
# ==============================================================================
# Project-specific variables used by the generic install.sh / update.sh scripts.
# Edit this file for your environment before running install.sh.
# ==============================================================================

APP_DISPLAY_NAME="Basket Bot"
APP_SLUG="basket-bot"
SERVICE_NAME="basket-bot-backend"
CORE_PACKAGE="@basket-bot/core"
DB_INIT_SCRIPT="db:init"       # pnpm script that initialises/seeds the database

HAS_MOBILE_APP=false           # Set to true if this app has an apps/mobile/ SPA to build

WARMUP_PATHS=("/api/health" "/api/auth/invitation-required")  # Paths to hit after startup to prime Next.js route compilation

DEFAULT_DOMAIN="basketbot.ddns.net"   # Default used if user presses Enter at the HTTPS prompt
CADDY_LOG_NAME="basket-bot"

GIT_REPO="https://github.com/thedinj/basket-bot.git"

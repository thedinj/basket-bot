# Basket Bot - Setup Instructions

This guide will walk you through setting up the Basket Bot monorepo for development.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** v20 or higher
- **pnpm** v9 or higher (package manager)
- **Git** for version control

### Install pnpm

If you don't have pnpm installed:

```bash
npm install -g pnpm@latest
```

## Initial Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url> basket-bot
cd basket-bot
```

### 2. Install Dependencies

Install all dependencies for the monorepo (this will install packages for all workspaces):

```bash
pnpm install
```

This will install dependencies for:
- Root workspace
- `packages/core`
- `apps/backend`
- `apps/mobile`

### 3. Configure Environment Variables

#### Backend Configuration

Create environment file for the backend:

```bash
cd apps/backend
cp .env.example .env
```

Edit `apps/backend/.env` and update the following variables:

```env
# Database
DATABASE_URL="file:./dev.db"

# JWT Configuration - CHANGE THESE IN PRODUCTION!
JWT_SECRET="your-secret-key-change-this-in-production"
JWT_ISSUER="basket-bot"
JWT_AUDIENCE="basket-bot-api"
ACCESS_TOKEN_TTL_SECONDS=900          # 15 minutes
REFRESH_TOKEN_TTL_SECONDS=2592000     # 30 days

# Admin Bootstrap User - CHANGE THESE!
ADMIN_EMAIL="admin@basket-bot.local"
ADMIN_PASSWORD="change-this-password"

# Server
NODE_ENV="development"
PORT=3000
```

**Important:** Change `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` before deploying to production!

#### Mobile Configuration

Create environment file for the mobile app:

```bash
cd apps/mobile
cp .env.example .env
```

Edit `apps/mobile/.env`:

```env
# API Configuration
VITE_API_URL=http://localhost:3000
```

### 4. Initialize the Database

The backend uses Prisma with SQLite. Initialize the database:

```bash
cd apps/backend

# Generate Prisma client
pnpm db:generate

# Run migrations to create database schema
pnpm db:migrate

# Seed the database with admin user
pnpm db:seed
```

This will:
- Generate the Prisma client
- Create the SQLite database with all tables
- Create an admin user with credentials from your `.env` file

### 5. Build Shared Packages

Build the shared `@basket-bot/core` package:

```bash
# From the root of the monorepo
pnpm --filter @basket-bot/core build
```

Or build everything:

```bash
pnpm build
```

## Running the Applications

### Development Mode (All Apps)

Run all applications in development mode simultaneously:

```bash
# From the root of the monorepo
pnpm dev
```

This will start:
- `packages/core` in watch mode
- Backend server at `http://localhost:3000`
- Mobile dev server at `http://localhost:8100`

### Run Individual Applications

#### Backend Only

```bash
cd apps/backend
pnpm dev
```

The backend will be available at:
- API: `http://localhost:3000/api`
- Admin Portal: `http://localhost:3000/admin`
- Health Check: `http://localhost:3000/api/health`

#### Mobile Only

```bash
cd apps/mobile
pnpm dev
```

The mobile app will be available at `http://localhost:8100`

## Testing the Setup

### 1. Test the Backend API

Test user registration:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "password": "testpassword123"
  }'
```

Test user login:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

### 2. Test Admin Login

Use the admin credentials from your `.env` file:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@basket-bot.local",
    "password": "change-this-password"
  }'
```

### 3. Access the Mobile App

Open `http://localhost:8100` in your browser to see the mobile app.

## Building for Production

### Build All Packages and Apps

```bash
pnpm build
```

### Build Individual Packages/Apps

```bash
# Build core package
pnpm --filter @basket-bot/core build

# Build backend
pnpm --filter @basket-bot/backend build

# Build mobile
pnpm --filter @basket-bot/mobile build
```

## Database Management

### View Database with Prisma Studio

```bash
cd apps/backend
pnpm db:studio
```

This opens a web interface at `http://localhost:5555` to browse and edit your database.

### Create New Migration

After modifying `apps/backend/prisma/schema.prisma`:

```bash
cd apps/backend
pnpm db:migrate
```

### Reset Database (Development Only)

```bash
cd apps/backend
rm -f prisma/dev.db prisma/dev.db-journal
pnpm db:migrate
pnpm db:seed
```

## Mobile Native Development (iOS/Android)

### Add iOS/Android Platforms

```bash
cd apps/mobile

# Add iOS (requires macOS + Xcode)
npx cap add ios

# Add Android (requires Android Studio)
npx cap add android
```

### Sync Native Projects

After building the mobile app or changing Capacitor config:

```bash
cd apps/mobile
pnpm build
npx cap sync
```

### Open in Native IDE

```bash
# iOS (macOS only)
npx cap open ios

# Android
npx cap open android
```

## Common Commands

### Monorepo Management

```bash
# Install all dependencies
pnpm install

# Build all packages and apps
pnpm build

# Run all apps in dev mode
pnpm dev

# Run tests
pnpm test

# Lint all code
pnpm lint

# Type check all code
pnpm typecheck

# Format all code
pnpm format

# Clean all build outputs
pnpm clean
```

### Backend Commands

```bash
cd apps/backend

# Development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Database commands
pnpm db:generate    # Generate Prisma client
pnpm db:migrate     # Run migrations
pnpm db:studio      # Open Prisma Studio
pnpm db:seed        # Seed database
```

### Mobile Commands

```bash
cd apps/mobile

# Development server
pnpm dev

# Build for web
pnpm build

# Preview production build
pnpm preview

# Capacitor commands
npx cap add ios
npx cap add android
npx cap sync
npx cap open ios
npx cap open android
```

## Troubleshooting

### "Cannot find module '@basket-bot/core'"

Make sure you've built the core package:

```bash
pnpm --filter @basket-bot/core build
```

### Prisma Client Issues

Regenerate the Prisma client:

```bash
cd apps/backend
pnpm db:generate
```

### Port Already in Use

If port 3000 (backend) or 8100 (mobile) is already in use, you can:

1. Kill the process using the port
2. Change the port in the respective configuration files

### Database Locked Error

SQLite database is locked. Close Prisma Studio or any other database connections.

### TypeScript Errors After Installing Dependencies

Run type checking to see specific errors:

```bash
pnpm typecheck
```

## Next Steps

1. **Review the Architecture**: Read [.github/copilot-instructions.md](.github/copilot-instructions.md) for coding conventions and architecture guidelines.

2. **Start Building Features**: Follow the feature development checklist in the copilot instructions.

3. **Explore the Codebase**:
   - `packages/core/src/schemas/` - Shared Zod schemas
   - `apps/backend/src/app/api/` - API route handlers
   - `apps/backend/src/lib/` - Backend utilities and services
   - `apps/mobile/src/` - Mobile app components and pages

4. **Set Up Deployment**: For Raspberry Pi deployment, see the deployment section below.

## Deployment to Raspberry Pi (systemd)

### Prerequisites on Pi

```bash
# Install Node.js (use nvm or apt)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm@9
```

### Build and Deploy

On your development machine:

```bash
# Build for production
pnpm build

# Create deployment archive (from backend directory)
cd apps/backend
tar -czf basket-bot-backend.tar.gz .next node_modules package.json prisma
```

On the Raspberry Pi:

```bash
# Create app directory
sudo mkdir -p /opt/basket-bot
sudo chown $USER:$USER /opt/basket-bot
cd /opt/basket-bot

# Extract archive
tar -xzf ~/basket-bot-backend.tar.gz

# Copy .env file with production settings
cp .env.example .env
# Edit .env with production values

# Run migrations
pnpm db:migrate:deploy
pnpm db:seed
```

### Create systemd Service

Create `/etc/systemd/system/basket-bot.service`:

```ini
[Unit]
Description=Basket Bot Backend
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/basket-bot
Environment=NODE_ENV=production
ExecStart=/usr/bin/pnpm start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable basket-bot
sudo systemctl start basket-bot
sudo systemctl status basket-bot
```

### View Logs

```bash
sudo journalctl -u basket-bot -f
```

## Support

For issues or questions, refer to:
- [README.md](README.md) - Project overview
- [.github/copilot-instructions.md](.github/copilot-instructions.md) - Detailed coding guidelines
- Project documentation in `docs/` (if available)

---

**Happy coding! 🛒🤖**

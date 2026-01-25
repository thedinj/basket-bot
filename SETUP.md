# Basket Bot - Setup Instructions

This guide covers setting up the Basket Bot monorepo for **development**. For **production deployment** on Raspberry Pi, see [apps/backend/readme.md](apps/backend/readme.md).

## Prerequisites

- **Node.js v18 or higher**
- **pnpm** (package manager)
- **Git**

### Install pnpm

```bash
npm install -g pnpm
```

## Development Setup

### 1. Clone and Install

```bash
git clone <repository-url> basket-bot
cd basket-bot
pnpm install
```

### 2. Build Core Package

The backend and mobile apps depend on `@basket-bot/core`:

```bash
pnpm --filter @basket-bot/core build
```

### 3. Configure Backend

```bash
cd apps/backend
cp .env.example .env
```

Edit `.env` and set at minimum:

- `ADMIN_EMAIL` - your admin login email
- `ADMIN_NAME` - your admin display name
- `ADMIN_PASSWORD` - your admin password
- `JWT_SECRET` - generate with `openssl rand -base64 32`

Other defaults are fine for development.

### 4. Initialize Database

```bash
# From apps/backend/
pnpm db:init
```

Creates SQLite database with schema and seed data (admin user, sample household/store).

### 5. Configure Mobile (Optional)

Only needed if the backend runs on a different host/port:

```bash
cd apps/mobile
cp .env.example .env
# Edit VITE_API_URL if needed (default: http://localhost:3000)
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
Development Servers

### Backend Only

```bash
cd apps/backend
pnpm dev
```

Available at:

- **API**: `http://localhost:3000/api`
- **Admin Portal**: `http://localhost:3000/admin`

### Mobile Only

```bash
cd apps/mobile
pnpm dev
```

Available at: `http://localhost:8100`

### Both Together

Run from separate terminals, or use VS Code tasks (see `.vscode/tasks.json`)

# Build backend

pnpProduction Builds

### Backend

See [apps/backend/readme.md](apps/backend/readme.md) for complete production deployment instructions including:

- Automated install script for Raspberry Pi
- Systemd service setup
- Environment configuration
- Database management

### Mobile (Android APK)

```bash
cd apps/mobile
pnpm android:prod
```

Outputs APK to `apps/mobile/android/app/build/outputs/apk/release/`

## Database Management

### Reset Database

```bash
cd apps/backend
pnpm db:init
```

⚠️ Destroys all data and recreates from scratch with seed data.
Open `http://localhost:3000/admin` and login with your admin credentials from `.env`.

### Access Mobile App

Open `http://localhost:8100`

### Android

The Android project already exists. To work with it:

```bash
cd apps/mobile

# Sync after code/config changes
pnpm build
pnpm cap:sync

# Open in Android Studio
npx cap open android
```

### iOS

iOS is not currently configured. To add it (macOS + Xcode required):

```bash
cd apps/mobile
npx cap add ios
npx cap open ioson
pnpm build

# Start production server
pnpm start

# Database commands
pnpm db:init        # Initialize database schema and seed with test data
```

### Mobile Commands

````bFrom Project Root

```bash
pnpm install                              # Install all dependencies
pnpm --filter @basket-bot/core build      # Build core package
pnpm build                                 # Build all packages/apps
````

### Backend (apps/backend/)

```bash
pnpm dev                    # Development server
pnpm build                  # Production build
pnpm start                  # Run production build
pnpm db:init                # Initialize/reset database
pnpm typecheck              # Type check
pnpm lint                   # Lint code
```

### Mobile (apps/mobile/)

````bash
pnpm dev                    # Development server (web)
pnpm build                  # Production build (web)
pnpm cap:sync               # Sync web build to native projects
pnpm android:prod           # Build production APK
npx cap open android        # Open in Android Studio
## Deployment to Raspberry Pi (systemd)

### Prerequisites on Pi

```bash
# Install Node.js (use nvm or apt)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm@9
````

### Build and Deploy

On your development machine:

```bash
# Build for production
pnpm build

# Create deployment archive (from backend directory)
cd apps/backend
tar -czf basket-bot-backend.tar.gz .next node_modules package.json db src
```

On the Raspberry Pi:
Build the core package:

```bash
pnpm --filter @basket-bot/core build
```

**Critical**: Always rebuild core after modifying types/schemas in `packages/core`.

### Type Errors After Editing Core

```bash
pnpm --filter @basket-bot/core build
```

Then restart your dev servers.

### Port Conflicts

- Backend default: 3000 (change via `PORT` in `.env`)
- Mobile default: 8100 (change in `vite.config.ts`)

### Database Errors

Reset the database:

```Monorepo Structure

```

basket-bot/
├── packages/
│ └── core/ # Shared domain model + Zod schemas
│ └── src/schemas/ # All validation schemas (source of truth)
├── apps/
│ ├── backend/ # Next.js API + admin portal
│ │ ├── src/app/api/ # API route handlers
│ │ ├── src/lib/ # Services, repos, auth utilities
│ │ └── src/db/ # Database schema
│ └── mobile/ # Ionic/Capacitor mobile app
│ ├── src/pages/ # Page components
│ ├── src/db/ # API client + TanStack Query
│ └── src/auth/ # Auth context
└── .github/
└── copilot-instructions.md # Complete architecture guide

```

## Key Conventions

- **Always use pnpm** (never npm/yarn)
- **Zod schemas in `packages/core/src/schemas/`** - single source of truth
- **React components**: `const` arrow functions with `React.FC<Props>`
- **No inline styles** - use SCSS with shared variables
- **Async/await over promise chains**
- **Strict TypeScript** - no `any`, prefer Zod inference

See [.github/copilot-instructions.md](.github/copilot-instructions.md) for complete coding guidelines.

## Production Deployment

For Raspberry Pi deployment with systemd:
- See [apps/backend/readme.md](apps/backend/readme.md)
- Use `apps/backend/scripts/install.sh` for automated setup
```

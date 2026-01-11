# Basket Bot

A shopping-list system with a Next.js backend and Ionic/Capacitor mobile app.

## Repository Structure

This is a TypeScript monorepo managed with pnpm workspaces and Turbo.

- `packages/core/` - Shared domain model, Zod schemas, and utilities
- `apps/backend/` - Next.js App Router (API + admin portal)
- `apps/mobile/` - Ionic/Capacitor mobile application
- `.github/` - Copilot instructions and workflows

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Monorepo**: pnpm workspaces + Turbo
- **Backend**: Next.js App Router, Prisma, SQLite
- **Mobile**: Ionic, Capacitor
- **Validation**: Zod
- **Auth**: JWT (access + refresh tokens)
- **Admin UI**: Mantine
- **Deployment**: Raspberry Pi with systemd

## Getting Started

See [SETUP.md](SETUP.md) for detailed setup instructions.

## Development

```bash
# Install dependencies
pnpm install

# Run all apps in development mode
pnpm dev

# Build all packages and apps
pnpm build

# Run tests
pnpm test

# Lint all code
pnpm lint

# Type check all code
pnpm typecheck
```

## Architecture

### Shared Core (`packages/core`)

Contains domain models, Zod schemas, and shared utilities. No framework dependencies.

### Backend (`apps/backend`)

Next.js application with:
- `/api/*` - JSON REST API (JWT protected)
- `/admin/*` - Admin portal (Mantine UI, admin scope required)

### Mobile (`apps/mobile`)

Ionic/Capacitor application:
- Always-online (no offline sync)
- TanStack Query for server state
- Secure token storage

## Contributing

See [.github/copilot-instructions.md](.github/copilot-instructions.md) for coding conventions and patterns.

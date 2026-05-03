# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Basket Bot is a TypeScript monorepo for a shopping list system with a Next.js backend and an Ionic/Capacitor mobile frontend. It uses pnpm workspaces + Turbo for orchestration, SQLite for storage, and JWT for auth.

See `.github/copilot-instructions.md` for comprehensive coding conventions.

## Common Commands

**Root-level (run from repo root via Turbo):**
```bash
pnpm dev          # Start all apps in dev mode
pnpm build        # Build all apps
pnpm test         # Run all tests
pnpm lint         # Lint all code
pnpm typecheck    # Type-check all packages
pnpm format       # Format with Prettier
pnpm clean        # Clean all builds and node_modules
```

**Backend only (`apps/backend/`):**
```bash
pnpm dev              # Next.js dev server (port 3000)
pnpm build && pnpm start  # Production
pnpm db:init          # Initialize fresh database (first-time only)
pnpm db:migrate       # Apply pending migrations
pnpm db:migrate:rollback  # Rollback last migration
pnpm db:seed          # Seed database
```

**Mobile only (`apps/mobile/`):**
```bash
pnpm dev              # Vite dev server (port 8100)
pnpm build:prod       # Production build (CAP_DEV_SERVER=false)
pnpm android:dev      # Android with hot reload dev server
pnpm android          # Full Android build & run
pnpm cap:sync:prod    # Sync Capacitor for production
```

**Core package (`packages/core/`):**
```bash
pnpm test             # Vitest unit tests
pnpm build            # Compile TypeScript to dist/
pnpm dev              # Watch mode
```

**Run a single test file:**
```bash
cd packages/core && pnpm vitest run src/schemas/mySchema.test.ts
```

## Architecture

### Monorepo Layout

```
packages/core/        # Shared domain: Zod schemas and inferred TypeScript types
apps/backend/         # Next.js 15 App Router — REST API + Mantine admin portal
apps/mobile/          # Ionic + Capacitor (Vite/React) — always-online mobile client
```

`packages/core` is the single source of truth for all shared types. Both apps import from it as `@basket-bot/core`.

### Backend Layers

```
app/api/*             # Route handlers — HTTP in/out only
app/admin/*           # Admin portal pages (Mantine UI)
lib/services/         # Business logic and authorization checks
lib/repos/            # Database access via better-sqlite3 prepared statements
lib/auth/             # JWT, password hashing, withAuth() middleware
```

Route handlers validate input with Zod, call services, and return JSON. Services call repos and enforce authorization. Repos never contain business logic.

### Mobile State Management

- **TanStack Query** for all server state (never local useState for fetched data)
- **Three-file context pattern** for complex shared state: `MyContext.ts`, `MyProvider.tsx`, `useMyContext.ts`
- **Mutation queuing** persists failed mutations and retries on reconnect
- **Shield system** blocks UI during long-running operations

### Data Hierarchy

```
Store → Aisle → Section → Item
```

Stores have owners and collaborators. Households exist but are reserved for future use (do not use for store sharing). Section normalization: if an item has a section, the section's aisle is authoritative and the item's `aisle_id` is NULL.

## Database (SQLite + better-sqlite3)

- Schema source of truth: `apps/backend/src/db/init.ts` (for fresh databases)
- Migrations: `apps/backend/src/db/migrations/` (timestamp-prefixed filenames)
- Booleans stored as `1` (true) or `NULL` (false) — never `0`
- Hard-deletes only; no soft-delete pattern

**Schema change checklist — all three must be done together:**
1. Create a new migration file in `apps/backend/src/db/migrations/`
2. Update `apps/backend/src/db/init.ts` to reflect the new schema
3. Update Zod schemas in `packages/core/src/schemas/` and rebuild core (`pnpm build`)

## Authentication

- Short-lived JWT access token in `Authorization: Bearer <token>` header
- Long-lived refresh token as HttpOnly cookie (web) or Capacitor secure storage (mobile)
- JWT claims: `sub` (user ID), `scopes: string[]` (contains `"admin"` for admins)
- Use `withAuth()` middleware in route handlers to validate and extract the JWT

## Key Conventions

### TypeScript & React

- Strict mode everywhere; infer types from Zod schemas with `z.infer<typeof schema>`
- React components: `const MyComponent: React.FC<Props> = () => {}` (arrow functions, never `function` declarations)
- File names: camelCase for utilities/hooks, PascalCase only for component files
- Import order: React → third-party → internal packages → relative imports

### Formatting (`.prettierrc`)

- 4-space indentation
- 100-character line width
- No semicolons
- Trailing commas

### UI

- Backend admin portal: **Mantine UI only** — no other component libraries
- Mobile: **Ionic components** for all interactive UI elements
- No multi-form modals; use separate pages/sheets for complex forms

### Anti-patterns to avoid

- No ad-hoc `interface` declarations — define types from Zod schemas in `packages/core`
- No `useEffect` for data fetching — use TanStack Query
- No duplicate type definitions across packages
- Don't use `function` keyword for React components

## Environment Files

- `apps/backend/.env.example` — JWT secrets, admin bootstrap credentials, registration code
- `apps/mobile/.env.example` — API URL override, Capacitor dev server flag (`CAP_DEV_SERVER`)

Copy and fill these before running locally.

## Deployment

The backend deploys as a systemd service on a Raspberry Pi with a Caddy reverse proxy. See `docs/HTTPS_SETUP.md` and `docs/NOIP_SETUP.md` for infrastructure setup. Deployment scripts are in `apps/backend/scripts/`.

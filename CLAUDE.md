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

**Backend only (`apps/backend/`) — tests:**

```bash
pnpm test             # Vitest against an in-memory SQLite schema
```

Backend suites get a real schema with no setup: `test/setup/inMemoryDb.ts` claims `globalThis.db`
before `lib/db/db.ts` is evaluated and runs `initializeDatabase()`, so every repo transparently
talks to a fresh `:memory:` database (one per test file). Seed rows with the factories in
`test/support/fixtures.ts` and call `resetDb()` from `test/support/resetDb.ts` in a `beforeEach`
when a file needs per-test isolation.

**Run a single test file:**

```bash
cd packages/core && pnpm vitest run src/schemas/mySchema.test.ts
pnpm --filter @basket-bot/mobile test src/utils/dateUtils.test.ts
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

**Error handling — every route's `catch` block must call `toErrorResponse(error, req, { userId })`**
(from `lib/errors/handleRouteError.ts`), never a hand-rolled `NextResponse.json({ code, message }, { status })`.
Services and repos must throw typed error classes from `@basket-bot/core`
(`AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`, `ValidationError`) instead of
`new Error("...")` or a string-prefixed message — `toErrorResponse` maps each type to the right HTTP status,
logs it (console + the `ErrorLog` table, viewable at `/admin/error-logs`), and returns a `requestId` the client
can round-trip back to you. Full pattern, status-code table, and a migration checklist:
[`apps/backend/docs/ERROR_HANDLING.md`](apps/backend/docs/ERROR_HANDLING.md).

### Mobile State Management

- **TanStack Query** for all server state (never local useState for fetched data)
- **Three-file context pattern** for complex shared state: `MyContext.ts`, `MyProvider.tsx`, `useMyContext.ts`
- **Mutation queuing** persists failed mutations and retries on reconnect
- **Shield system** blocks UI during long-running operations

**Query keys — always use the `queryKeys` factory:** every cache key is declared once in
[`apps/mobile/src/db/queryKeys.ts`](apps/mobile/src/db/queryKeys.ts) and **must** be built
by calling a function on the exported `queryKeys` object (e.g.
`queryKeys.shoppingListItems.byStore(storeId)`). Never hand-write a raw key array — a
mistyped factory call is a compile error, whereas a mistyped string array silently no-ops.
This applies to `useQuery`/`useSuspenseQuery`/`useInfiniteQuery` and every
`invalidateQueries`/`removeQueries`/`refetchQueries`/`setQueryData`/`getQueryData` call, as
well as `RefreshConfig queryKeys` / `refresh([...])`.

**Cache invalidation contract (avoids stale-data bugs):** every mutation must
`invalidateQueries` the exact key of _every_ query that surfaces the changed data, not
just the obvious one. Query keys are an exact kebab-case vocabulary (e.g.
`queryKeys.shoppingListItems.byStore(storeId)` → `["shopping-list-items", storeId]`) — a
typo silently no-ops. Gotchas: store-item edits must also invalidate the shopping list
(`queryKeys.shoppingListItems.byStore(storeId)`);
ops that create a store item must invalidate both `queryKeys.items.byStore(storeId)` and
`queryKeys.items.withDetails(storeId)`; **ingredient mutations must invalidate both the
recipe detail AND `queryKeys.recipes.byHousehold(householdId)`** (the list carries full
ingredient details).
**Full registry + cascade tables (keep updated in the same change):**
[`apps/mobile/docs/CACHE_KEYS.md`](apps/mobile/docs/CACHE_KEYS.md).
**These rules are enforced**: [`apps/mobile/src/db/cacheCascade.test.ts`](apps/mobile/src/db/cacheCascade.test.ts)
(store domain) and [`apps/mobile/src/db/mealsCascade.test.ts`](apps/mobile/src/db/mealsCascade.test.ts)
(recipes/plans/tags) run every mutation hook and assert the exact set of keys it invalidates, and a
coverage guard in each fails the suite when a new mutation hook has no documented cascade. Adding a
mutation means adding its row there too.

**Mutation errors are handled centrally — never add a per-hook `onError` toast.** The
shared `QueryClient` in [`apps/mobile/src/db/DatabaseContext.tsx`](apps/mobile/src/db/DatabaseContext.tsx)
has a `MutationCache.onError` that shows the toast and records the failure to the local
`clientErrorLog` (viewable via Settings → tap the version 7×) for every mutation. When
adding a new `useMutation`/`useTanstackMutation`/`useOptimisticMutation`, just pass
`meta: { operation: "short description" }` so the global handler can build a specific
message — do not write your own `onError: (error) => showError(...)`, that produces a
double toast (the global handler still fires) or, if the mutation has no `onError` at
all, historically caused _silent_ failures instead. If a mutation needs to react to a
specific error itself (e.g. an inline form field error, or a silent cache refresh on a 404) instead of the generic toast, call `markErrorHandled(error)` from
`apps/mobile/src/utils/errorUtils.ts` inside its `onError` to suppress the global toast
for that error — see `useToggleItemChecked` (404 → silent refresh) in
[`apps/mobile/src/db/shoppingListHooks.ts`](apps/mobile/src/db/shoppingListHooks.ts) for the
pattern.

Name conflicts arrive as a `ConflictError` with a specific code (`AISLE_NAME_CONFLICT`,
`SECTION_NAME_CONFLICT`, `ITEM_NAME_CONFLICT`) and a message naming the existing row, so the
generic toast is already useful; add an `onError` + `markErrorHandled` only when a screen wants
the message inline on the field instead. Note `updateItem` is the exception — a rename onto an
existing name _merges_ the two items rather than conflicting.

**Every `IonFab` needs a `FabSpacer`:** a `slot="fixed"` FAB floats over scrollable
content, so the last row(s) of any list/table it sits on top of become unclickable unless
the scrollable content has extra bottom clearance. Always render
[`<FabSpacer />`](apps/mobile/src/components/shared/FabSpacer.tsx) as the last child inside
`IonContent`, immediately before the `IonFab` element(s), on every page/modal that renders
a FAB — even if the FAB only appears conditionally (e.g. per-tab or per-segment), the
`FabSpacer` must render unconditionally for every state that can show that FAB. Do not
invent ad-hoc padding — reuse `FabSpacer` so clearance stays consistent with the FAB's
actual size and safe-area handling.

### LLM features (mobile-only)

All AI runs client-side in `apps/mobile/src/llm/`; the backend makes no LLM calls. It does
own one thing — the **model catalogue** (see below). Three rules keep it provider-agnostic:

- **Never name a model at a call site.** Features declare a capability tier — `fast`
  (item categorization), `smart` (parsing pasted lists/recipes), or `vision` (store scans)
  — and the concrete model comes from the user's config. A request carrying an attachment
  is upgraded to `vision` automatically by `runLLM`, so a text-only bulk import still uses
  the cheap model.
- **Never call a provider directly.** [`runLLM`](apps/mobile/src/llm/shared/runLLM.ts) is
  the only entry point: it resolves provider + model, keeps the screen awake, and
  validates the response with the caller's Zod schema. `LLMModalConfig` takes `tier` and
  `schema`, never `model`.
- **Vendors are named in exactly one place**:
  [`llm/providers/registry.ts`](apps/mobile/src/llm/providers/registry.ts). Adding a
  provider (including a future backend proxy — `requiresApiKey: false` plus an adapter
  posting to our own API) is one descriptor entry; no feature or settings field changes.
  The registry owns provider _identity_ — the adapter that speaks each wire format — but
  **not** model names; the `defaultModels` / `knownModels` on a descriptor are only the
  offline fallback for the catalogue.

Response shapes are Zod schemas in `llm/features/*.ts` (`bulkImportResponseSchema`,
`recipeImportResponseSchema`, `autoCategorizeResultSchema`, `storeScanResultSchema`) —
never hand-written type guards. They also drive structured output for providers that
support it, via `toStructuredOutputSchema` (which strips the JSON Schema keywords those
compilers reject).

**Model names are server-owned data, not app code.** The backend serves them from
[`lib/data/llmCatalog.ts`](apps/backend/src/lib/data/llmCatalog.ts) at `GET /api/llm/catalog`
(the same static-catalog pattern as `storeTemplates.ts`), so pointing every install at a
newer model is a backend edit plus a redeploy — no app release and nothing for a user to do.
The client fetches it with `useLLMCatalog` and merges it over the registry fallbacks in
[`llm/config/llmCatalog.ts`](apps/mobile/src/llm/config/llmCatalog.ts); a null catalogue
(offline, older backend, still loading) resolves to the bundled values rather than throwing.
Adding a model is one entry in the backend file — but the id is sent to the vendor verbatim,
so verify it against the vendor's own model list; the tests check the catalog's internal
consistency and cannot tell you an id exists.

Config lives in the Capacitor Preferences key `llm_config` (parsed by `parseLLMConfig`,
which never throws) and API keys in secure storage under `llm_api_key_${providerId}`.
The pre-provider `openai_api_key` slot is still **read** as a fallback so existing
installs keep working — never write to it.

**A model name is stored only when the user overrides it.** `llm_config.models` is sparse:
a tier the user left on "Use default" is absent, so it resolves against the catalogue on
every call and follows a new default automatically. Never resolve a blank field to today's
default on the way _into_ storage (`buildLLMSavePlan` used to, which pinned every install to
whatever it saw on its first save). The distinction to keep straight is **stored** config
(sparse — what Settings edits and `saveConfig` writes) vs **effective** config
(`useLLMConfig().effectiveConfig` — complete, recomputed per render, what `runLLM` takes).

### Name normalization

Two functions in `@basket-bot/core` (`packages/core/src/utils/normalizeName.ts`), and picking the
wrong one causes duplicate records:

- **`normalizeItemName`** — the storage/uniqueness key. Trims, lowercases, collapses whitespace;
  does **not** singularize. This is what is written to every `nameNorm` column and what the
  `UNIQUE (storeId, nameNorm)` constraints compare, so it is the only correct choice when
  comparing against a stored `nameNorm`.
- **`normalizeForSearch`** — the same, plus singularization. Display-side filtering only, and it
  must be applied to **both** sides of a comparison.

These were previously one same-named function defined twice with different behavior (the backend
collapsed whitespace, the client singularized), which made bulk import miss every plural and
create duplicate store items. Do not reintroduce a local copy in either app.

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

Steps 1 and 2 are enforced by `apps/backend/src/db/migrationDrift.test.ts`: it builds one database
from `init.ts` and another by replaying every migration onto an empty one, and requires the two
schemas to be identical (column _order_ is normalised away, since `ALTER TABLE ADD COLUMN` always
appends). Write a migration without updating `init.ts`, or vice versa, and it fails naming exactly
what each side is missing. `apps/backend/src/db/schemaSnapshot.test.ts` additionally renders any
`init.ts` change as a readable SQL diff in `__snapshots__/schema.sql` — accept an intentional one
with `pnpm test -u`.

**The migration chain starts at `00000000_000000_baseline.ts`**, which reconstructs the schema as
of just before the first real migration. It exists so migrations can be replayed onto an empty
database at all; it is frozen history, so never edit it — add a new migration. `runMigrations()`
records it as applied without executing it whenever the database already has tables, so it can
never resurrect the tables later migrations dropped.

A freshly `db:init`-ed database is already at the current schema, so `db:seed` stamps every
migration as applied (`markAllMigrationsApplied()`), leaving a subsequent `pnpm db:migrate` a
no-op rather than an error.

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

- 4-space indentation, no tabs
- 100-character line width
- Semicolons required
- Double quotes
- Trailing commas where ES5 allows them (arrays, objects — not function arguments)
- Always parenthesize arrow-function parameters

Don't hand-maintain any of this — run `pnpm format`. `.prettierrc` is the source of truth;
this list is a summary of it.

### UI

- Backend admin portal: **Mantine UI only** — no other component libraries
- Mobile: **Ionic components** for all interactive UI elements
- No multi-form modals; use separate pages/sheets for complex forms

### Anti-patterns to avoid

- No ad-hoc `interface` declarations — define types from Zod schemas in `packages/core`
- No one-off inline object types in casts (`x as { status?: number }`, `x as unknown as { foo(): void }`) — cast to a standard type from `@basket-bot/core` or an existing exported interface, narrow with `instanceof` (e.g. `error instanceof ApiError`), or drop the cast. If a cast only exists to reach a member that isn't on the real type, fix the type or remove the dead code — don't invent a shape. Avoid `as any` where a concrete type fits.
- No `useEffect` for data fetching — use TanStack Query
- No duplicate type definitions across packages
- Don't use `function` keyword for React components

## Environment Files

- `apps/backend/.env.example` — JWT secrets, admin bootstrap credentials, registration code
- `apps/mobile/.env.example` — API URL override, Capacitor dev server flag (`CAP_DEV_SERVER`)

Copy and fill these before running locally.

## Deployment

The backend deploys as a systemd service on a Raspberry Pi with a Caddy reverse proxy. See `docs/HTTPS_SETUP.md` and `docs/NOIP_SETUP.md` for infrastructure setup. Deployment scripts are in `apps/backend/scripts/`.

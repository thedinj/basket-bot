# Copilot Instructions — Basket Bot

This repository is a TypeScript monorepo for **Basket Bot**, a shopping-list system with:

-   a shared core package (domain model + Zod schemas),
-   a **Next.js backend** (API + admin portal) deployed on a **Raspberry Pi** with **node + systemd**,
-   an **Ionic/Capacitor mobile app** that is always-online.

Copilot: prioritize correctness, consistency, and boring maintainable patterns over cleverness.

---

## Repo layout

-   `packages/core/`
    Shared domain model + Zod schemas + shared utilities. **No DB, no Next, no Capacitor, no React.** Pure TS.

-   `apps/backend/`
    Next.js App Router:

    -   `/api/*` JSON API (JWT protected)
    -   `/admin/*` React admin portal (JWT protected, requires admin scope)
    -   **Admin UI uses Mantine** (do not introduce other UI kits in admin).

-   `apps/mobile/`
    Ionic/Capacitor front end.

-   `.github/`
    This file lives here: `.github/copilot-instruction.md`

---

## Tech decisions (do not fight these)

-   Language: **TypeScript** everywhere.
-   Validation: **Zod** at boundaries; infer TS types from schemas.
-   DB: **SQLite + Prisma**.
-   Auth: backend-issued **JWT access token + refresh token**.
-   Sharing: **households** own lists; users can be members of households.
-   Permissions: **owner/editor/viewer** (per list is sufficient; household-level membership is preferred initially).
-   Mobile: **always-online** (no offline-first sync engine).

---

## Conventions and “source of truth”
### Schema synchronization (critical)

**When modifying database schema, you MUST update all three layers together:**

1. **SQL migration** (`apps/backend/prisma/migrations/*/migration.sql`)
2. **Prisma schema** (`apps/backend/prisma/schema.prisma`)
3. **Zod schemas** (`packages/core/src/schemas/*.ts`)

These three must always stay perfectly in sync. When adding/removing/renaming fields:

-   Update the migration SQL with correct DDL statements
-   Update the Prisma schema with matching field definitions and relations
-   Update all relevant Zod schemas (base schemas AND extended/detailed schemas)
-   Ensure field types match across all three (e.g., `TEXT`/`String`/`z.string()`)
-   Ensure nullability matches (`NULL`/`?`/`.nullable()`)
-   Keep naming consistent (camelCase in Prisma/Zod, snake_case if SQL requires it)

**Example: Adding a field to `Store`**

1. SQL: `ALTER TABLE "Store" ADD COLUMN "newField" TEXT NOT NULL;`
2. Prisma: `newField String` in `model Store`
3. Zod: `newField: z.string()` in `storeSchema`

Failure to keep these in sync will cause runtime validation errors, type mismatches, and migration failures.
### Shared types and validation

-   **All domain entities and API DTOs must have Zod schemas in `packages/core/src/schemas`.**
-   Export inferred types from those schemas and reuse them in backend + mobile.
-   Do not duplicate request/response types in apps.

### Domain vs IO separation

-   `packages/core` contains:

    -   domain types + validation schemas
    -   pure functions and mapping utilities
    -   constants, shared errors

-   `apps/backend` contains:

    -   DB access, auth, and route handlers
    -   “services” (use-case logic), calling repositories

-   `apps/mobile` contains:

    -   UI + calling API client
    -   token storage, navigation, view-model style logic

---

## Naming, file, and React conventions (apply across repo)

### Naming conventions

| Thing                   | Convention                                 | Examples                                                 |
| ----------------------- | ------------------------------------------ | -------------------------------------------------------- |
| React components        | PascalCase                                 | `UserTable`, `HouseholdInviteModal`                      |
| Component files         | `PascalCase.tsx`                           | `UserTable.tsx`                                          |
| Non-component TS files  | `camelCase.ts`                             | `jwt.ts`, `password.ts`, `withAuth.ts`                   |
| Hooks                   | `useXxx`                                   | `useSession()`, `useHouseholds()`                        |
| Context definition file | `FeatureContext.tsx`                       | `AdminSessionContext.tsx`                                |
| Context hook            | `useFeatureContext.ts`                     | `useAdminSessionContext.ts`                              |
| Zod schemas             | `camelCase` + `Schema`                     | `loginRequestSchema`, `householdSchema`                  |
| Types                   | Prefer Zod inference; otherwise PascalCase | `type LoginRequest = z.infer<typeof loginRequestSchema>` |

### Three-file context pattern (React)

For any non-trivial shared UI state (modals, selection, multi-step flows), use this pattern:

-   `FeatureContext.tsx` — `createContext` + exported value type
-   `FeatureProvider.tsx` — provider implementation
-   `useFeatureContext.ts` — consumer hook that throws if used without provider

### Imports

Order imports consistently:

1. React + ecosystem
2. UI library (Ionic for mobile, Mantine for admin)
3. Local modules
4. Types (`import type`)
5. Styles last

### Styling (CSS / SCSS)

-   **Avoid inline CSS and inline `style` props.**
-   Prefer shared SCSS files and shared UI components.
-   Use class-based styling (`className`) instead of inline styles.
-   SCSS is required and must be wired into the build for both backend admin and mobile.

SCSS organization guidelines:

-   Global variables/mixins in a central file (e.g. `styles/_variables.scss`, `styles/_mixins.scss`).
-   Feature-level styles colocated near components when appropriate.
-   Avoid deeply nested selectors; keep styles predictable.

For admin (Mantine):

-   Prefer Mantine theming and class overrides instead of inline styles.
-   Custom layout or spacing rules should live in SCSS, not JSX.

---

### TypeScript

-   Strict mode; no `any`.
-   Prefer Zod inference over handwritten interfaces.
-   Avoid ad-hoc inline interfaces; add shared types/schemas to `packages/core`.

---

## Backend (Next.js) guidance

### API style

-   Use REST-ish JSON endpoints under `/api`.
-   Requests/Responses must be validated/serialized using Zod schemas from `@basket-bot/core`.
-   Prefer clear endpoint naming over over-generalized “RPC” endpoints.

### Auth model

-   Access token: JWT (short-lived)
-   Refresh token: long-lived, stored server-side and revocable

Rules:

-   Access token must be sent as `Authorization: Bearer <token>`.
-   Refresh token should be stored as an **HttpOnly cookie** for web/admin.
-   Mobile may store refresh token securely (Capacitor secure storage or platform keychain) and exchange it at `/api/auth/refresh`.

JWT claims:

-   `sub` = user id
-   `email` (optional)
-   `scopes: string[]` (include `admin` if applicable)
-   `iat`, `exp`, issuer/audience if configured

Authorization:

-   Implement a small `withAuth()` wrapper for route handlers.
-   Protected endpoints must verify JWT and enforce household/list membership.
-   Admin portal routes must require `admin` scope.

### Admin bootstrap user

-   On initial setup/migration/seed:

    -   Create a single admin user if none exists.
    -   Password is provided via env var (e.g. `ADMIN_EMAIL`, `ADMIN_PASSWORD`).
    -   Set `scopes` to include `admin`.

Do not hardcode credentials. Fail clearly if env vars are missing when seeding.

### Household creation

-   Do **not** auto-create a household for every new user.
-   Prefer:

    -   user registers,
    -   then either creates a household,
    -   or is invited/added to an existing household (feature later).

### Prisma / SQLite

-   Prefer Prisma schema for relations:

    -   `User`
    -   `Household`
    -   `HouseholdMember` (role)
    -   `List`
    -   `ListItem`

-   Use migrations; do not manually mutate production DB.
-   Keep SQLite file path configurable via env.

### Suggested backend structure

Inside `apps/backend/src`:

-   `lib/auth/` (`jwt.ts`, `password.ts`, `withAuth.ts`)
-   `lib/db/` (`prisma.ts`)
-   `lib/repos/` (DB access)
-   `lib/services/` (use-case logic)
-   `app/api/...` (route handlers)
-   `app/admin/...` (admin UI — Mantine)

Admin portal UI rules:

-   Use Mantine components (`@mantine/core`, `@mantine/hooks`, `@mantine/form`) for layout/forms/tables.
-   Avoid raw HTML controls (`<button>`, `<input>`) unless Mantine does not provide an equivalent.
-   Keep admin pages simple: user list, user detail, DB table viewer/read-only inspection.

### Error handling

-   Return consistent JSON error shapes:

    -   `code` (string)
    -   `message` (string)
    -   optional `details`

-   Avoid leaking secrets (token contents, password rules, stack traces) in production responses.

---

## Mobile (Ionic/Capacitor) guidance

UI rules:

-   Prefer Ionic components for mobile UI; avoid raw HTML controls unless required.

State/data rules:

-   Use TanStack Query for server state; avoid storing server data in component state.
-   Keep complex UI state in feature contexts (three-file context pattern).

Token handling:

-   Access token: in-memory + persisted if needed (prefer short persistence).
-   Refresh token: secure storage (keychain/keystore) if available.

API client rules:

-   Use a small API client wrapper:

    -   attach access token automatically,
    -   refresh on 401 using refresh token,
    -   retry once after refresh.

-   Validate server responses (Zod) for critical flows.

-   Do not embed backend-only code in mobile.

-   Use a small API client wrapper:

    -   attach access token automatically,
    -   refresh on 401 using refresh token,
    -   retry once after refresh.

-   Validate server responses (Zod) for critical flows.

Token handling:

-   Access token: in-memory + persisted if needed (prefer short persistence).
-   Refresh token: secure storage (keychain/keystore) if available.

---

## “How to write code here”

### General coding style

-   Prefer small, testable functions.
-   Avoid heavy abstraction; this is a simple app.
-   Use `async/await`.
-   Avoid `any`; use inferred types from Zod schemas.

### Zod usage

-   Put schemas in `packages/core/src/schemas`.
-   For each API endpoint define:

    -   `RequestSchema` and `ResponseSchema`

-   In backend route handlers:

    -   parse input using `RequestSchema.parse(...)`
    -   ensure output matches `ResponseSchema`

### Testing

-   Prefer unit tests for pure core logic.
-   For backend, add basic route/service tests where cheap.
-   Avoid snapshot-heavy tests.

---

## Environment variables (backend)

Use `.env.example` in `apps/backend` and document required env vars.

Likely env vars:

-   `DATABASE_URL` (SQLite)
-   `JWT_SECRET`
-   `JWT_ISSUER` (optional)
-   `JWT_AUDIENCE` (optional)
-   `ACCESS_TOKEN_TTL_SECONDS`
-   `REFRESH_TOKEN_TTL_SECONDS`
-   `ADMIN_EMAIL`
-   `ADMIN_PASSWORD`

---

## Deployment (Pi: node + systemd)

-   Assume a systemd service runs the backend.
-   Do not bake deployment-only paths into code; read from env/config.
-   Avoid Docker-specific assumptions unless explicitly asked.

---

## End-to-end feature checklist (Copilot)

When implementing a new feature, follow this order and keep changes minimal and consistent.

1. **Core contracts (shared)**

    - Add/modify Zod schemas in `packages/core/src/schemas`:

        - domain schemas (if needed)
        - request/response DTO schemas for any new endpoints

    - Export inferred types (`z.infer<...>`) and reuse everywhere.

2. **Database (backend)**

    - Update `apps/backend/prisma/schema.prisma`.
    - Create a Prisma migration.
    - Add/adjust repo methods in `apps/backend/src/lib/repos`.

3. **Service layer (backend)**

    - Implement business logic in `apps/backend/src/lib/services`.
    - Enforce authorization here (household/list membership, role checks), not only in routes.

4. **API routes (backend)**

    - Add Next route handler(s) under `apps/backend/src/app/api/...`.
    - Validate input with request schema; validate/shape output with response schema.
    - Wrap protected handlers with `withAuth()`.

5. **Admin portal (backend)**

    - If admin needs it, add a Mantine page under `apps/backend/src/app/admin/...`.
    - Use shared feature context pattern for non-trivial state.
    - No inline styles; prefer SCSS + shared components.

6. **Mobile app**

    - Add API client method(s) (typed by shared schemas).
    - Integrate into UI using Ionic components.
    - Use TanStack Query for server state.

7. **Error/edge cases**

    - Confirm error shape consistency (`code`, `message`, optional `details`).
    - Confirm auth flows:

        - access token attached
        - refresh on 401 once
        - proper logout revokes refresh token

8. **Tests (cheap but useful)**

    - Add unit tests for pure core logic.
    - Add at least one backend service/repo test if the feature touches permissions or sharing.

9. **Docs/ops (as needed)**

    - Update `.env.example` if new env vars are required.
    - Update `docs/api/openapi.yaml` (or generation inputs) if applicable.

---

## When you (Copilot) generate code, default to:

-   implementing schemas in `packages/core` first,
-   then backend route handler + service/repo,
-   then mobile client call + UI integration.

If something is ambiguous, pick the simplest approach consistent with:

-   households + sharing,
-   JWT + refresh token,
-   Prisma + SQLite,
-   Next.js API routes + admin portal.

Be consistent across the repo.

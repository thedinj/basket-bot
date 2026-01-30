# Copilot Instructions — Basket Bot

This repository is a TypeScript monorepo for **Basket Bot**, a shopping-list system with:

- a shared core package (domain model + Zod schemas),
- a **Next.js backend** (API + admin portal) deployed on a **Raspberry Pi** with **node + systemd**,
- an **Ionic/Capacitor mobile app** that is always-online.

Copilot: prioritize correctness, consistency, and boring maintainable patterns over cleverness.

**CRITICAL: When investigating tricky issues, CONFIRM SPECULATIONS BEFORE IMPLEMENTING FIXES by introducing debug code (logging, tracking reference changes, etc.). NEVER implement a fix based on speculation alone. Add logging → test → analyze logs → confirm root cause → then implement fix. Remove debug code on an ongoing basis as soon as it is no longer needed.**

**CRITICAL: After making ANY changes, ALWAYS check for errors using get_errors tool before considering work complete. Do not stop until all errors are resolved.**

---

## Repo layout

- `packages/core/`
  Shared domain model + Zod schemas + shared utilities. **No DB, no Next, no Capacitor, no React.** Pure TS.

- `apps/backend/`
  Next.js App Router:
    - `/api/*` JSON API (JWT protected)
    - `/admin/*` React admin portal (JWT protected, requires admin scope)
    - **Admin UI uses Mantine** (do not introduce other UI kits in admin).

- `apps/mobile/`
  Ionic/Capacitor front end.

- `.github/`
  This file lives here: `.github/copilot-instruction.md`

---

## Tech decisions (do not fight these)

- Language: **TypeScript** everywhere.
- Validation: **Zod** at boundaries; infer TS types from schemas.
- DB: **SQLite + better-sqlite3**.
- Auth: backend-issued **JWT access token + refresh token**.
- **Stores**: Users own stores directly. Stores can have collaborators (owner + invited editors). Owner can delete store; if owner leaves, store is deleted with cascade to all store entities.
- **Households**: Reserved for future meal planning features only. Not used for stores/shopping lists.
- Mobile: **always-online** (no offline-first sync engine).
- **Data retention: This is a low-stakes shopping list app. Prefer hard-deleting unimportant data (like revoked tokens) rather than soft-deletes or keeping audit trails. No plans for cleanup batch jobs.**
- **Breaking changes: This app is RELEASED. All database schema changes MUST include proper migrations. Never reseed or break existing user data.**

---

## Conventions and “source of truth”

### Schema synchronization (critical)

**When modifying database schema, you MUST update THREE layers together:**

1. **Migration script** (create new migration file in `apps/backend/src/db/migrations/`)
2. **SQL schema** (`apps/backend/src/db/init.ts` - update for new database initialization)
3. **Zod schemas** (`packages/core/src/schemas/*.ts`)

All three must stay perfectly in sync. When adding/removing/renaming fields:

- Create a new migration file with timestamp prefix (e.g., `YYYYMMDD_HHMMSS_description.ts`)
- Write forward migration (up) and backward migration (down) logic
- Update the SQL schema in init.ts for fresh database initialization
- Update all relevant Zod schemas (base schemas AND extended/detailed schemas)
- Ensure field types match across all three layers
- Ensure nullability matches (`NULL`/`.nullable()`, `NOT NULL`/required field)
- Keep naming consistent (camelCase in TypeScript/Zod, snake_case in SQL if preferred)
- Test migration on a copy of production data before deploying

**Example: Adding a field to `Store`**

1. Migration: Create `20260128_123000_add_store_new_field.ts` with ALTER TABLE statement
2. Init.ts: Update CREATE TABLE statement to include the field
3. Zod: Add `newField: z.string()` in `storeSchema`

Failure to keep these in sync will cause runtime validation errors, type mismatches, and query failures.

**CRITICAL: Never modify existing migration files. Always create new migrations for schema changes.**

### Shared types and validation

- **All domain entities, API DTOs, and ALL Zod schemas must live in `packages/core/src/schemas`.**
- Export inferred types from those schemas and reuse them in backend + mobile.
- Do not duplicate request/response types or schemas in apps. Never define a Zod schema outside of core.

### Domain vs IO separation

- `packages/core` contains:
    - domain types + validation schemas
    - pure functions and mapping utilities
    - constants, shared errors

- `apps/backend` contains:
    - DB access, auth, and route handlers
    - “services” (use-case logic), calling repositories

- `apps/mobile` contains:
    - UI + calling API client
    - token storage, navigation, view-model style logic

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

- `FeatureContext.tsx` — `createContext` + exported value type
- `FeatureProvider.tsx` — provider implementation
- `useFeatureContext.ts` — consumer hook that throws if used without provider

### Imports

Order imports consistently:

1. React + ecosystem
2. UI library (Ionic for mobile, Mantine for admin)
3. Local modules
4. Types (`import type`)
5. Styles last

### Styling (CSS / SCSS)

- **Avoid inline CSS and inline `style` props.**
- Prefer shared SCSS files and shared UI components.
- Use class-based styling (`className`) instead of inline styles.
- SCSS is required and must be wired into the build for both backend admin and mobile.

SCSS organization guidelines:

- Global variables/mixins in a central file (e.g. `styles/_variables.scss`, `styles/_mixins.scss`).
- Feature-level styles colocated near components when appropriate.
- Avoid deeply nested selectors; keep styles predictable.

For admin (Mantine):

- Prefer Mantine theming and class overrides instead of inline styles.
- Custom layout or spacing rules should live in SCSS, not JSX.

---

### TypeScript

- Strict mode; no `any`.
- Prefer Zod inference over handwritten interfaces.
- **Never create ad-hoc interface declarations inline.** Always check if a type exists in `packages/core/src/schemas` or existing model files before creating new types.
- If you need a new type, add it to `packages/core/src/schemas` for domain entities or API DTOs.
- Interfaces for object shapes, types for unions/utilities.
- Use `as const` for literal types and constant objects.
- Explicit return types for exported functions (improves intellisense and catches errors).

### Dependencies and packages

- **Prefer widely-used and trusted packages over custom implementations when both options are similar.**
- The best code is no code—leverage well-maintained libraries instead of reinventing the wheel.
- Examples: Use `next-rate-limit` for rate limiting instead of building custom solutions.
- Only implement custom solutions when:
    - No suitable package exists
    - Package adds significant complexity or dependencies
    - Custom solution is trivially simple (e.g., < 50 lines)

### React component conventions

### Hooks returning complex objects

**When writing custom hooks that return a complex object (such as multiple values or functions), always return a memoized object using `useMemo`.**

This prevents unnecessary re-renders and ensures referential stability for consumers. Example:

```typescript
const value = useMemo(
    () => ({
        foo,
        bar,
        baz,
    }),
    [foo, bar, baz]
);
return value;
```

Never return a new object literal directly from a hook unless it is memoized. This is critical for context providers and hooks consumed by dependency arrays.

- **ALWAYS use `const` arrow functions**, never function declarations:

    ```typescript
    // ✅ Good
    const MyComponent: React.FC<MyComponentProps> = ({ name }) => {
      return <div>{name}</div>;
    };

    // ❌ Bad
    function MyComponent(props: MyComponentProps) {
      return <div>{props.name}</div>;
    }
    ```

- **ALWAYS use `React.FC<Props>` for components with props** (required for type safety).

- **ALWAYS use `export default` for the main component in a file:**

    ```typescript
    // ✅ Good
    const MyComponent: React.FC<MyComponentProps> = ({ name }) => {
      return <div>{name}</div>;
    };

    export default MyComponent;

    // Import without curly braces
    import MyComponent from "./MyComponent";

    // ❌ Bad
    export const MyComponent: React.FC<MyComponentProps> = ({ name }) => {
      return <div>{name}</div>;
    };

    // Import with curly braces
    import { MyComponent } from "./MyComponent";
    ```

    **Exception:** Context providers, hooks, and utility components that are exported alongside the main component can use named exports.

- **Prefer `async/await` over promise chains:**

    ```typescript
    // ✅ Good
    const loadData = async () => {
        try {
            const data = await fetchData();
            return data;
        } catch (error) {
            handleError(error);
        }
    };

    // ❌ Bad
    const loadData = () => {
        return fetchData()
            .then((data) => data)
            .catch((error) => handleError(error));
    };
    ```

### Form UI Patterns

**CRITICAL: Never create "uber-forms" with multiple independent submit buttons in a single modal/page.**

This creates confusing UX where users might:

- Start editing one form section
- Submit a different section
- Lose unsaved changes or create data inconsistencies

**Anti-pattern example (DO NOT DO THIS):**

```tsx
// ❌ BAD - Multiple forms with separate submits in one modal
<IonModal>
    <form onSubmit={handleProfileSubmit}>
        <input name="name" />
        <button type="submit">Save Profile</button>
    </form>

    <form onSubmit={handlePasswordSubmit}>
        <input name="password" />
        <button type="submit">Change Password</button>
    </form>
</IonModal>
```

**Correct pattern:**

- **Each modal/page should contain ONE form with ONE submit action**
- If you need to edit multiple unrelated things, create separate modals/pages
- Each gets its own menu item or navigation entry

**Example (GOOD):**

```tsx
// ✅ GOOD - Separate modals for separate concerns
<ProfileEditorModal />  {/* One form: edit name */}
<PasswordChangeModal /> {/* One form: change password */}

// In menu:
<IonItem onClick={openProfile}>Profile</IonItem>
<IonItem onClick={openPassword}>Change Password</IonItem>
```

**Why:** This keeps each modal focused, prevents user confusion, and ensures form state isolation.

### Async Data Loading

- **Avoid `isLoading` flags in contexts.** Use React's `use()` hook to suspend during async operations, relying on existing `<Suspense>` boundaries.
- This keeps components cleaner and leverages React's built-in async handling.
- Example: Instead of `const [isLoading, setIsLoading] = useState(true)`, use `const data = use(asyncOperation())`.

---

## Backend (Next.js) guidance

### API style

- Use REST-ish JSON endpoints under `/api`.
- Requests/Responses must be validated/serialized using Zod schemas from `@basket-bot/core`.
- Prefer clear endpoint naming over over-generalized “RPC” endpoints.

### Auth model

- Access token: JWT (short-lived)
- Refresh token: long-lived, stored server-side and revocable

Rules:

- Access token must be sent as `Authorization: Bearer <token>`.
- Refresh token should be stored as an **HttpOnly cookie** for web/admin.
- Mobile may store refresh token securely (Capacitor secure storage or platform keychain) and exchange it at `/api/auth/refresh`.

JWT claims:

- `sub` = user id
- `email` (optional)
- `scopes: string[]` (include `admin` if applicable)
- `iat`, `exp`, issuer/audience if configured

Authorization:

- Implement a small `withAuth()` wrapper for route handlers.
- Protected endpoints must verify JWT and enforce household/list membership.
- Admin portal routes must require `admin` scope.

### Admin bootstrap user

- On initial setup/migration/seed:
    - Create a single admin user if none exists.
    - Password is provided via env var (e.g. `ADMIN_EMAIL`, `ADMIN_PASSWORD`).
    - Set `scopes` to include `admin`.

Do not hardcode credentials. Fail clearly if env vars are missing when seeding.

### Household creation

- Do **not** auto-create a household for every new user.
- Prefer:
    - user registers,
    - then either creates a household,
    - or is invited/added to an existing household (feature later).

### Database / SQLite

- Use **better-sqlite3** for direct SQLite access (synchronous, performant).
- Database schema is maintained via SQL scripts in `src/db/init.ts`.
- All database access uses prepared statements for safety.
- Schema includes:
    - `User`
    - `Household`
    - `HouseholdMember` (role)
    - `Store`, `StoreAisle`, `StoreSection`, `StoreItem`
    - `ShoppingListItem`
    - `RefreshToken`
    - `QuantityUnit`, `AppSetting`

**Database workflow:**

- To initialize fresh database: `pnpm db:init` (runs schema + seed) - NEW DATABASES ONLY
- To apply migrations: `pnpm db:migrate` (applies pending migrations) - PRODUCTION
- Direct SQL queries via `db.prepare(...).run/get/all()`
- Always use `datetime('now')` for timestamps in SQLite

**Database migrations (CRITICAL - app is released):**

The app is now released with real user data. All schema changes MUST be done through migrations.

**Migration file structure:**

- Location: `apps/backend/src/db/migrations/`
- Naming: `YYYYMMDD_HHMMSS_description.ts` (timestamp ensures ordering)
- Must export `up()` and `down()` functions
- Each function receives the database connection

**Migration rules:**

1. **Never modify existing migration files** - they've already run in production
2. **Always create new migrations** for any schema change
3. **Test on production data copy** before deploying
4. **Make migrations reversible** when possible (implement `down()`)
5. **Handle data migration** - don't just ALTER TABLE, migrate existing data if needed
6. **Be backwards compatible** when possible - add nullable fields, provide defaults
7. **Migration order matters** - timestamp prefix ensures correct execution order

**Migration example:**

```typescript
// apps/backend/src/db/migrations/20260128_120000_add_store_tags.ts
import type { Database } from "better-sqlite3";

export function up(db: Database): void {
    db.exec(`
    ALTER TABLE "Store" ADD COLUMN "tags" TEXT;
    UPDATE "Store" SET "tags" = '[]' WHERE "tags" IS NULL;
  `);
}

export function down(db: Database): void {
    db.exec(`ALTER TABLE "Store" DROP COLUMN "tags";`);
}
```

**When to use init.ts vs migrations:**

- **init.ts**: Only for creating fresh/test databases from scratch
- **Migrations**: For all production schema changes
- Both must stay in sync - update init.ts when creating migrations

**Boolean storage convention:**

SQLite doesn't have a native boolean type. We store booleans as:

- `1` for `true`
- `NULL` for `false`

Repositories must convert between TypeScript booleans and SQLite integers/nulls:

- Use `boolToInt()` helper when writing: `true` → `1`, `false`/`null` → `NULL`
- Use `intToBool()` helper when reading: `1` → `true`, `NULL`/`0` → `false`

This convention saves space and makes intent clearer than storing `0` for false.

**Critical design principle: Section-Aisle normalization**

When storing `StoreItem` location data:

- If `sectionId` is provided, store ONLY the section (set `aisleId` to `NULL`)
- If only `aisleId` is provided, store the aisle (section remains `NULL`)
- This allows sections to be moved between aisles without updating all items

When querying with joins:

- Use `COALESCE(section.aisleId, item.aisleId)` to get the effective aisle
- This resolves the aisle from the section's parent if the item has a section

Example normalization logic:

```typescript
const normalizedAisleId = sectionId ? null : (aisleId ?? null);
const normalizedSectionId = sectionId ?? null;
```

### Suggested backend structure

Inside `apps/backend/src`:

- `lib/auth/` (`jwt.ts`, `password.ts`, `withAuth.ts`)
- `lib/db/` (`db.ts`)
- `lib/repos/` (DB access)
- `lib/services/` (use-case logic)
- `app/api/...` (route handlers)
- `app/admin/...` (admin UI — Mantine)

Admin portal UI rules:

- Use Mantine components (`@mantine/core`, `@mantine/hooks`, `@mantine/form`) for layout/forms/tables.
- Avoid raw HTML controls (`<button>`, `<input>`) unless Mantine does not provide an equivalent.
- Keep admin pages simple: user list, user detail, DB table viewer/read-only inspection.

### Error handling

- Return consistent JSON error shapes:
    - `code` (string)
    - `message` (string)
    - optional `details`

- Avoid leaking secrets (token contents, password rules, stack traces) in production responses.

---

## Mobile (Ionic/Capacitor) guidance

UI rules:

- Prefer Ionic components for mobile UI; avoid raw HTML controls unless required.

State/data rules:

- Use TanStack Query for server state; avoid storing server data in component state.
- Keep complex UI state in feature contexts (three-file context pattern).

Routing rules:

- **Use declarative Ionic React Router patterns with `<Route>` and `<Redirect>` components.**
- **Never use `useHistory` or `useLocation` with `useEffect` for navigation logic.**
- Use `<IonRouterOutlet>` for proper Ionic page transitions.
- For protected routes, create wrapper components (`ProtectedRoute`, `AuthRoute`) that render `<Route>` with conditional `<Redirect>`.
- For programmatic navigation (e.g., after delete), use `useIonRouter` instead of `useHistory`.
- For simple navigation (buttons/links), use `routerLink` prop on Ionic components instead of `onClick` with `history.push`.

Token handling:

- Access token: in-memory + persisted if needed (prefer short persistence).
- Refresh token: secure storage (keychain/keystore) if available.

API client rules:

- Use a small API client wrapper:
    - attach access token automatically,
    - refresh on 401 using refresh token,
    - retry once after refresh.

- Validate server responses (Zod) for critical flows.
- Do not embed backend-only code in mobile.

### Network resilience and offline handling

The mobile app implements robust network error handling with mutation queuing for offline support.

**Architecture:**

- **TanStack Query** for server state with intelligent retry logic
- **Mutation Queue** for persisting failed mutations (via Capacitor Preferences)
- **Network Status Monitoring** via TanStack Query's `onlineManager`
- **API Timeout** of 15 seconds with proper error classification

**Query configuration (DatabaseContext.tsx):**

```typescript
staleTime: 2 * 60 * 1000,  // 2 minutes - data stays fresh
gcTime: 10 * 60 * 1000,    // 10 minutes - cache retention
retry: (failureCount, error: unknown) => {
  // Smart retry: skip 4xx except timeout/rate-limit, max 3 attempts
  if (error instanceof ApiError && error.status) {
    if (error.status >= 400 && error.status < 500) {
      return error.status === 408 || error.status === 429;
    }
  }
  return failureCount < 3;
},
retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
```

**Error classification (ApiClient):**

- Network errors (timeout, no connection) have `isNetworkError: true` flag on `ApiError`
- Timeout after 15 seconds using `AbortController`
- Distinguish network failures from auth/validation/server errors

**Mutation queuing pattern:**

All mutations in `RemoteDatabase` are wrapped with `executeMutation()`:

```typescript
private async executeMutation<T>(
  operation: () => Promise<T>,
  mutationName: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiError && error.isNetworkError) {
      await mutationQueue.enqueue(mutationName, operation);
      throw error; // Still throw so UI can show feedback
    }
    throw error;
  }
}
```

**Queue persistence:**

- Stored in Capacitor Preferences as JSON under key `"mutation_queue"`
- Survives app restarts
- FIFO processing order
- Permanent failures (4xx except 408/429) are discarded from queue
- Server state wins on conflict (no optimistic retry)

**User-facing features:**

- `<NetworkStatusBanner />` shows offline status and pending change count
- Refresh button in AppHeader (via `<GlobalActions />`) to manually refetch data
- Sync button appears when queue has pending mutations
- Toast notifications on sync completion with success/failure counts

**Key hooks:**

- `useNetworkStatus()` - monitor online/offline state
- `useMutationQueue()` - subscribe to queue size and processing state
- `useRefreshAndSync()` - manual refresh and sync operations
- `usePreloadCoreData()` - prefetch stores/aisles/sections (30min cache)

**Error message formatting:**

Use `formatErrorMessage(error)` from `utils/errorUtils.ts` for consistent user-facing error text:

- Network errors: "Network error. Please check your connection."
- Timeout errors: "Request timed out. Please check your connection."
- Auth errors: "Please log in again" (clears tokens)
- Validation errors: Shows field-specific messages
- Server errors: Generic message without exposing internals

**Critical pattern: Always use `unknown` in catch blocks, never `any`:**

```typescript
try {
    await operation();
} catch (error: unknown) {
    if (error instanceof ApiError && error.isNetworkError) {
        // Handle network error
    }
    throw error;
}
```

**Documentation:**

- See `NETWORK_RESILIENCE.md` for full technical details
- See `NETWORK_QUICK_START.md` for developer quick reference

### Shield infrastructure (blocking UI overlay)

The mobile app has a **Shield** system for blocking user input during long-running background operations (e.g., LLM calls).

**Architecture:**

- Three-file context pattern in `components/shield/`:
    - `ShieldContext.tsx` - Context definition
    - `ShieldProvider.tsx` - Provider with Set-based ID tracking
    - `useShield.ts` - Consumer hook
- `Shield.tsx` - Full-screen blocking overlay component
- Placed in app hierarchy at top level (wraps all other providers)

**Shield behavior:**

- Transparent for first 500ms, then fades to translucent backdrop with blur effect
- Centers throbbing robot icon (floating + pulsing glow animations)
- Displays optional message below icon
- Completely blocks all user input (`pointer-events: auto`)
- Stays active until all raised shield IDs are lowered

**API:**

```typescript
const { raiseShield, lowerShield } = useShield();

// Raise shield with unique ID and optional message
raiseShield("my-operation", "Processing with AI...");

// Always lower in finally block
try {
    await longRunningOperation();
} finally {
    lowerShield("my-operation");
}
```

**When to use Shield:**

- ✅ All LLM operations (auto-categorize, bulk import, store scanning) - both modal-based and background
- ✅ Long-running operations (> 1-2 seconds) where user should not interact with UI
- ✅ Operations that continue after modal dismissal (e.g., bulk import processing continues after modal closes)
- ❌ Quick operations (< 500ms)
- ❌ Operations with their own full-screen blocking UI (rare)

**Remove other loading indicators:** When Shield is active, remove redundant loading states like disabled buttons, spinners in modals, or `isLoading` flags. Shield provides the primary feedback.

**Bulk import pattern:** Raise shield when starting import, keep it raised while processing all items (even after modal closes), lower it only after the last item completes. Use a single shield ID for the entire batch operation.

**Multiple shields:**

Shield uses Set-based ID tracking, so multiple callers can raise shields with different IDs. The shield overlay stays visible until all IDs are lowered. This prevents premature dismissal when multiple operations are running.

### Z-index conventions

**Standard z-index layers for mobile app:**

| Layer              | Z-Index | Usage                           | Example                          |
| ------------------ | ------- | ------------------------------- | -------------------------------- |
| Content            | 0-999   | Normal page content             | Regular components               |
| Overlay animations | 10000   | Non-blocking visual effects     | `OverlayAnimation` (laser sweep) |
| Modals             | 10000+  | Ionic modals (auto-managed)     | `IonModal`, `IonAlert`           |
| Shield             | 15000   | Blocking overlay for operations | `<Shield />` component           |

**Rules:**

- Do not use z-index values between 1000-9999 (reserved gap)
- Overlay animations use `pointer-events: none` (non-blocking)
- Shield uses `pointer-events: auto` (blocks all input)
- Ionic modals manage their own z-index (typically 10000+)
- Shield must be above modals to block input during modal-triggered operations

**When adding new overlay layers:**

1. Determine if it should block input (use `pointer-events: auto`) or not
2. Choose z-index based on stacking requirements
3. Document the layer in this table
4. Consider interaction with existing layers (Shield, modals, animations)

---

## “How to write code here”

### General coding style

- Prefer small, testable functions.
- Avoid heavy abstraction; this is a simple app.
- Use `async/await`.
- Avoid `any`; use inferred types from Zod schemas.
- **Follow DRY (Don't Repeat Yourself) principles:**
    - When you notice repeated logic, types, or UI patterns, create shared infrastructure (utilities, hooks, components, schemas, etc.) in the appropriate shared location.
    - Prefer extracting reusable code to `packages/core` (for domain logic/schemas) or shared folders in each app (e.g., `src/components/shared/`, `src/lib/`).
    - If a pattern is repeated in multiple places, refactor to a single source of truth.
    - Document new shared infrastructure for future contributors.

### Monorepo dependency management

- **Always use `pnpm` for installing dependencies.**
- To add a dependency to a specific app or package, run:
    - `pnpm add <package> --filter <workspace-name>`
        - Example: `pnpm add react-hook-form --filter @basket-bot/mobile`
    - Or, from the app/package directory: `pnpm add <package>`
- Never use `npm install` or `yarn add`—this repo is pnpm-only.
- For dev dependencies, use `pnpm add -D <package> --filter <workspace-name>`.
- For global workspace tools, use `pnpm add -w <package>`.

### Zod usage

- Put schemas in `packages/core/src/schemas`.
- For each API endpoint define:
    - `RequestSchema` and `ResponseSchema`

- In backend route handlers:
    - parse input using `RequestSchema.parse(...)`
    - ensure output matches `ResponseSchema`

- Always validate external data (API responses, user input) with Zod before using it.

### Testing

- Prefer unit tests for pure core logic.
- For backend, add basic route/service tests where cheap.
- Avoid snapshot-heavy tests.

---

## Environment variables (backend)

Use `.env.example` in `apps/backend` and document required env vars.

Likely env vars:

- `JWT_SECRET`
- `JWT_ISSUER` (optional)
- `JWT_AUDIENCE` (optional)
- `ACCESS_TOKEN_TTL_SECONDS`
- `REFRESH_TOKEN_TTL_SECONDS`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

---

## Deployment (Pi: node + systemd)

- Assume a systemd service runs the backend.
- Do not bake deployment-only paths into code; read from env/config.
- Avoid Docker-specific assumptions unless explicitly asked.

---

## End-to-end feature checklist (Copilot)

When implementing a new feature, follow this order and keep changes minimal and consistent.

1. **Core contracts (shared)**
    - Add/modify Zod schemas in `packages/core/src/schemas`:
        - domain schemas (if needed)
        - request/response DTO schemas for any new endpoints

    - Export inferred types (`z.infer<...>`) and reuse everywhere.

2. **Database (backend)**
    - Update `apps/backend/src/db/init.ts` with SQL schema changes.
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

- implementing schemas in `packages/core` first,
- then backend route handler + service/repo,
- then mobile client call + UI integration.

**Always use pnpm commands for installs, builds, and scripts.**

If something is ambiguous, pick the simplest approach consistent with:

- households + sharing,
- JWT + refresh token,
- better-sqlite3 + SQLite,
- Next.js API routes + admin portal.

Be consistent across the repo.

---

## Critical Anti-Patterns

### ❌ Don't: Create Ad Hoc Interface Declarations

```typescript
// ❌ BAD - Creating inline interface when type exists elsewhere
interface Store {
    id: string;
    name: string;
}

const StoreCard = ({ store }: { store: Store }) => { ... };

// ✅ GOOD - Import existing type from core
import type { Store } from '@basket-bot/core';

const StoreCard: React.FC<{ store: Store }> = ({ store }) => { ... };
```

**Why:** Duplicate type definitions lead to inconsistencies and bypass the single source of truth principle.

### ❌ Don't: Use Function Declarations

```typescript
// ❌ BAD - Function declaration
function MyComponent(props: MyComponentProps) {
    return <div>{props.name}</div>;
}

// ✅ GOOD - Const arrow function with React.FC
const MyComponent: React.FC<MyComponentProps> = ({ name }) => {
    return <div>{name}</div>;
};
```

**Why:** Const arrow functions are the standard pattern. Consistent syntax improves readability.

### ❌ Don't: Skip Zod Validation for External Data

```typescript
// ❌ BAD - No validation
const data = await response.json();
await db.createItems(data.items); // Could be malformed!

// ✅ GOOD - Validate first
const responseSchema = z.object({ items: z.array(itemSchema) });
const data = responseSchema.parse(await response.json());
await db.createItems(data.items);
```

**Why:** External data can be malformed. Validation prevents database corruption and crashes.

### ❌ Don't: Ignore Loading and Error States

```typescript
// ❌ BAD - Accessing data before it's loaded
const { data: stores } = useQuery(...);
return <div>{stores.map(...)}</div>; // Crashes if still loading!

// ✅ GOOD - Handle loading/error states (or use useSuspenseQuery)
const { data: stores, isLoading, error } = useQuery(...);
if (isLoading) return <Spinner />;
if (error) return <ErrorMessage />;
return <div>{stores.map(...)}</div>;
```

**Why:** App crashes when data is still loading. Always handle these states or use Suspense boundaries.

### ❌ Don't: Create Large Infrastructure Without Consultation

```typescript
// ❌ BAD - Building custom state management library
class GlobalStateManager {
    // 500 lines of custom implementation...
}

// ✅ GOOD - Use existing libraries
import { useQuery } from "@tanstack/react-query";
```

**Why:** Existing libraries are battle-tested. Custom infrastructure creates technical debt.

**Rule of thumb:** If you're about to create something that could be a standalone library, STOP and ask first.

---

## Important Note: Core Package Rebuild

**Whenever you make changes to types, schemas, or code in `packages/core`, you MUST rebuild the core package (`pnpm --filter @basket-bot/core build`) before errors or type problems in dependent packages (backend, mobile) can be resolved.**

If you see errors that seem to persist after editing core types, rebuild the core package and try again.

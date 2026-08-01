# Backend Error Handling

Every route handler must funnel unexpected errors through `toErrorResponse` so
failures are consistently shaped, logged, and traceable by `requestId`. This is
what lets an admin look up a user-reported failure in the Error Logs admin page
(`/admin/error-logs`) and see exactly what happened server-side.

## The pattern

```ts
import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as fooService from "@/lib/services/fooService";
import { NextResponse } from "next/server";

async function handleGet(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { fooId } = await params;
        const foo = fooService.getFoo(fooId, req.auth.sub);
        return NextResponse.json({ foo });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const GET = withAuth(handleGet);
```

- Always pass `{ userId: req.auth.sub }` when the route is behind `withAuth` (omit it
  for unauthenticated routes like `/api/auth/login` or `/api/auth/register`).
- Do **not** hand-roll `NextResponse.json({ code, message }, { status })` for error
  branches inside the `catch` block — that's exactly what `toErrorResponse` replaces.
  Expected-outcome branches that aren't errors (e.g. an explicit 401 for bad login
  credentials) can still return a manual `NextResponse.json(...)` directly in the
  handler body, since those aren't exceptions.
- `withAuth` itself calls `toErrorResponse` for anything that escapes the handler, so
  a route without its own `try/catch` still gets a logged, shaped 500 instead of an
  unhandled crash — but every route should still catch its own business errors so it
  can pass `userId` and get correct status codes for typed errors thrown deeper in the
  call stack (see below).

## Throw typed errors, not plain `Error`

Services and repos must throw one of the typed classes from `@basket-bot/core`
(`packages/core/src/errors/index.ts`) instead of `new Error("some string")` or a
string-prefixed message like `"CONFLICT: ..."`. `toErrorResponse` maps each type to
the correct HTTP status and error `code`:

| Throw | Status | Default `code` |
|---|---|---|
| `new AuthenticationError(message?)` | 401 | `AUTHENTICATION_FAILED` |
| `new AuthorizationError(message?)` | 403 | `AUTHORIZATION_FAILED` |
| `new NotFoundError(message?)` | 404 | `NOT_FOUND` |
| `new ConflictError(message?, code?)` | 409 | `CONFLICT` |
| `new ValidationError(message?, details?)` | 400 | `VALIDATION_FAILED` |
| `ZodError` (thrown by `schema.parse(...)`) | 400 | `VALIDATION_FAILED` |
| better-sqlite3 constraint violation (`SQLITE_CONSTRAINT*`) | 409 | `CONFLICT` (message sanitized — the raw SQL error is only logged, never returned to the client) |
| anything else | 500 | `INTERNAL_ERROR` |

`ConflictError`'s second argument lets you override the `code` when the client needs
to distinguish *which* conflict happened — e.g. `storeEntityService.ts` throws
`new ConflictError('An item named "X" already exists...', "ITEM_NAME_CONFLICT")`
because the mobile app's `ItemEditorModal` checks that exact code to show an inline
field error instead of a toast. Only add a custom code when a caller actually needs
to branch on it — an unused custom code is just a magic string to keep in sync.

Example conversion:

```ts
// Before
function verifyStoreAccess(storeId: string, userId: string): void {
    if (!storeRepo.userHasAccessToStore(userId, storeId)) {
        throw new Error("Access denied");
    }
}

// After
function verifyStoreAccess(storeId: string, userId: string): void {
    if (!storeRepo.userHasAccessToStore(userId, storeId)) {
        throw new AuthorizationError("Access denied");
    }
}
```

## Logging and the ErrorLog table

`toErrorResponse` logs every error twice: a structured `console.error` line (prefixed
with `[requestId]`) and a best-effort row in the `ErrorLog` table (via
`lib/repos/errorLogRepo.ts`) — a logging failure never breaks the actual response. The
`requestId` comes from the `X-Request-Id` header that `middleware.ts` stamps on every
`/api/*` request and echoes back on the response, so a `requestId` a user reports (or
an app's local debug log captures — see `apps/mobile/docs/`) can be looked up directly
against `/admin/error-logs`.

## Checklist for a new or migrated route

1. Route handler's `catch` block calls `toErrorResponse(error, req, { userId })`
   (or without `userId` if unauthenticated) — no hand-rolled status-code `if` chains.
2. Any business error thrown by the service/repo layer it calls is one of the typed
   classes above, not a plain `Error` or a string-prefixed message.
3. If you added a new error `code` string, grep the mobile app
   (`apps/mobile/src`) for any place that should react to it specifically (see the
   `ITEM_NAME_CONFLICT` example above) before assuming a generic toast is enough.

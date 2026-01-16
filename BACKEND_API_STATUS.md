# Backend API Implementation Status

## ✅ All Endpoints Complete!

### Repository Layer (`apps/backend/src/lib/repos/`)

- ✅ `storeRepo.ts` - Store CRUD operations
- ✅ `aisleRepo.ts` - Aisle CRUD operations + reorder
- ✅ `sectionRepo.ts` - Section CRUD operations + reorder
- ✅ `itemRepo.ts` - StoreItem CRUD operations + search + getOrCreate + **section-aisle normalization**
- ✅ `shoppingListRepo.ts` - Shopping list CRUD operations + toggle/clear + **query joins with COALESCE**
- ✅ `referenceRepo.ts` - Quantity units + app settings

**Critical Pattern Applied:** Items store only `sectionId` when section is provided (aisle becomes null), allowing sections to move between aisles without cascading updates. Queries use `COALESCE(section.aisleId, item.aisleId)` to resolve the effective aisle.

### Service Layer (`apps/backend/src/lib/services/`)

- ✅ `storeService.ts` - Store business logic + authorization
- ✅ `storeEntityService.ts` - Aisles, sections, items, shopping list with authorization

### API Endpoints (`apps/backend/src/app/api/`)

**Auth:**

- ✅ `/api/auth/refresh` - Refresh access token

**Stores:**

- ✅ `/api/stores` - GET (list by household), POST (create)
- ✅ `/api/stores/[storeId]` - GET, PUT, DELETE

**Aisles:**

- ✅ `/api/stores/[storeId]/aisles` - GET (list), POST (create)
- ✅ `/api/stores/[storeId]/aisles/[aisleId]` - GET, PUT, DELETE
- ✅ `/api/stores/[storeId]/aisles/reorder` - POST

**Sections:**

- ✅ `/api/stores/[storeId]/sections` - GET (list), POST (create)
- ✅ `/api/stores/[storeId]/sections/[sectionId]` - GET, PUT, DELETE
- ✅ `/api/stores/[storeId]/sections/reorder` - POST

**Items:**

- ✅ `/api/stores/[storeId]/items` - GET (list with optional ?q=search), POST (create)
- ✅ `/api/stores/[storeId]/items/[itemId]` - GET, PUT, DELETE
- ✅ `/api/stores/[storeId]/items/[itemId]/favorite` - POST (toggle)
- ✅ `/api/stores/[storeId]/items/search?q=xxx` - GET (dedicated search endpoint)

**Shopping List:**

- ✅ `/api/stores/[storeId]/shopping-list` - GET (list), POST (upsert with Zod validation)
- ✅ `/api/stores/[storeId]/shopping-list/[itemId]` - DELETE
- ✅ `/api/stores/[storeId]/shopping-list/[itemId]/toggle` - POST (requires `isChecked` in body)
- ✅ `/api/stores/[storeId]/shopping-list/clear-checked` - POST

**Reference Data:**

- ✅ `/api/quantity-units` - GET (list all, no auth required)

## Implementation Pattern Used

All protected endpoints follow this pattern:

```typescript
import { withAuth, AuthenticatedRequest } from "@/lib/auth/withAuth";
import * as storeEntityService from "@/lib/services/storeEntityService";
import { NextResponse } from "next/server";

async function handleGet(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> } // ← Use Record for params
) {
    try {
        const { storeId } = await params; // ← Await and destructure
        const result = storeEntityService.someMethod(storeId, req.auth.sub);
        return NextResponse.json({ result });
    } catch (error: any) {
        if (error.message === "Access denied") {
            return NextResponse.json(
                { code: "ACCESS_DENIED", message: "Access denied" },
                { status: 403 }
            );
        }
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Internal server error" },
            { status: 500 }
        );
    }
}

export const GET = withAuth(handleGet);
```

## Key Implementation Details

- **Params Typing:** Use `Promise<Record<string, string>>` (not specific types like `{ storeId: string }`)
- **Service Calls:** Pass params objects, not individual arguments: `createAisle({ storeId, name, userId })`
- **Authorization:** All enforced at service layer via `verifyStoreAccess()`
- **Validation:** Use Zod schemas for shopping list upsert
- **Error Handling:** Consistent shape with `code`, `message`, optional `details`
- **Status Codes:** 400 (bad input), 403 (access denied), 404 (not found), 500 (internal error)

## Next Steps for Full Integration

Backend API is complete! Next steps:

1. **Mobile RemoteDatabase Implementation** - Map all Database interface methods to API calls
2. **Mobile Auth Context** - AuthProvider, useAuth hook, login/logout screens
3. **Household Context** - Multi-household support with selector UI
4. **DB Provider Switching** - Environment variable to toggle fake vs remote
5. **End-to-End Testing** - Full integration testing

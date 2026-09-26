import { ValidationError } from "@basket-bot/core";
import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as storeEntityService from "@/lib/services/storeEntityService";
import { NextResponse } from "next/server";

/**
 * Resolve a store item by name, creating it only if this store really hasn't got one.
 *
 * Exists because the alternative is a client doing it in two steps — search, then create when
 * the search came back empty — and that is wrong in ways it cannot see. The search ranks and
 * truncates, hides hidden items, and compares display names; uniqueness is `(storeId,
 * nameNorm)` on every row. A client that misses for any of those reasons asks to create an item
 * that exists and gets an `ITEM_NAME_CONFLICT` it can do nothing about, on an item the user
 * picked from their own autocomplete. Two devices adding the same name at once had the same
 * ending. Here the lookup and the insert are one step, on the column the constraint uses.
 *
 * Not a PUT: it is not idempotent in the strict sense (it bumps the item's usage count), and
 * not on `POST /items`, which is "create this, or tell me it exists" — a distinction the
 * editor's rename flow still wants.
 */
async function handlePost(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId } = await params;
        const body = await req.json();
        const { name, aisleId, sectionId } = body;

        if (!name || typeof name !== "string") {
            throw new ValidationError("Name is required");
        }

        const item = storeEntityService.getOrCreateStoreItemByName({
            storeId,
            name,
            aisleId: aisleId ?? null,
            sectionId: sectionId ?? null,
            userId: req.auth.sub,
        });
        return NextResponse.json({ item });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const POST = withAuth(handlePost);

import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import * as storeEntityService from "@/lib/services/storeEntityService";
import { shoppingListItemInputSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

async function handleGet(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId } = await params;
        const items = storeEntityService.getShoppingListItems(storeId, req.auth.sub);
        return NextResponse.json({ items });
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

async function handlePost(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { storeId } = await params;
        const body = await req.json();

        // Validate input with Zod schema
        const validatedInput = shoppingListItemInputSchema.parse({
            ...body,
            storeId,
        });

        const item = storeEntityService.upsertShoppingListItem({
            ...validatedInput,
            userId: req.auth.sub,
        });
        return NextResponse.json({ item }, { status: body.id ? 200 : 201 });
    } catch (error: any) {
        console.error("POST shopping-list error:", error);
        if (error.message === "Access denied") {
            return NextResponse.json(
                { code: "ACCESS_DENIED", message: "Access denied" },
                { status: 403 }
            );
        }
        if (error.name === "ZodError") {
            return NextResponse.json(
                { code: "INVALID_INPUT", message: "Invalid input", details: error.errors },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Internal server error" },
            { status: 500 }
        );
    }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);

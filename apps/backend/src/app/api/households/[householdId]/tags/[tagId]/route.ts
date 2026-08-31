import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as recipeTagService from "@/lib/services/recipeTagService";
import { updateRecipeTagRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

async function handlePatch(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, tagId } = await params;
        const body = await req.json();
        const data = updateRecipeTagRequestSchema.parse(body);
        const tag = recipeTagService.updateTag(householdId, tagId, data, req.auth.sub);
        return NextResponse.json({ tag });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

async function handleDelete(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, tagId } = await params;
        recipeTagService.deleteTag(householdId, tagId, req.auth.sub);
        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const PATCH = withAuth(handlePatch);
export const DELETE = withAuth(handleDelete);

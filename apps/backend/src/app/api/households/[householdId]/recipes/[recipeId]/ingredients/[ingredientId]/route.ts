import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as recipeService from "@/lib/services/recipeService";
import { updateRecipeIngredientRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

async function handlePatch(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, recipeId, ingredientId } = await params;
        const body = await req.json();
        const data = updateRecipeIngredientRequestSchema.parse(body);
        const ingredient = recipeService.updateIngredient(
            householdId,
            recipeId,
            ingredientId,
            data,
            req.auth.sub
        );
        return NextResponse.json({ ingredient });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

async function handleDelete(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, recipeId, ingredientId } = await params;
        recipeService.deleteIngredient(householdId, recipeId, ingredientId, req.auth.sub);
        return NextResponse.json({ success: true });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const PATCH = withAuth(handlePatch);
export const DELETE = withAuth(handleDelete);

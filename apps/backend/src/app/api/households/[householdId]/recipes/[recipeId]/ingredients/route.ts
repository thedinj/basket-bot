import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as recipeService from "@/lib/services/recipeService";
import { addRecipeIngredientRequestSchema } from "@basket-bot/core";
import { NextResponse } from "next/server";

async function handlePost(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, recipeId } = await params;
        const body = await req.json();
        const data = addRecipeIngredientRequestSchema.parse(body);
        const ingredient = recipeService.addIngredient(householdId, recipeId, data, req.auth.sub);
        return NextResponse.json({ ingredient }, { status: 201 });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const POST = withAuth(handlePost);

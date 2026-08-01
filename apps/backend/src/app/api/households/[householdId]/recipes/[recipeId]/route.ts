import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import { toErrorResponse } from "@/lib/errors/handleRouteError"
import * as recipeService from "@/lib/services/recipeService"
import { updateRecipeRequestSchema } from "@basket-bot/core"
import { NextResponse } from "next/server"

async function handleGet(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, recipeId } = await params
        const recipe = recipeService.getRecipe(householdId, recipeId, req.auth.sub)
        return NextResponse.json({ recipe })
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub })
    }
}

async function handlePatch(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, recipeId } = await params
        const body = await req.json()
        const data = updateRecipeRequestSchema.parse(body)
        const recipe = recipeService.updateRecipe(householdId, recipeId, data, req.auth.sub)
        return NextResponse.json({ recipe })
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub })
    }
}

async function handleDelete(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, recipeId } = await params
        recipeService.deleteRecipe(householdId, recipeId, req.auth.sub)
        return NextResponse.json({ success: true })
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub })
    }
}

export const GET = withAuth(handleGet)
export const PATCH = withAuth(handlePatch)
export const DELETE = withAuth(handleDelete)

import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import { toErrorResponse } from "@/lib/errors/handleRouteError"
import * as recipeService from "@/lib/services/recipeService"
import { createRecipeRequestSchema } from "@basket-bot/core"
import { NextResponse } from "next/server"

async function handleGet(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId } = await params
        const recipes = recipeService.listRecipes(householdId, req.auth.sub)
        return NextResponse.json({ recipes })
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub })
    }
}

async function handlePost(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId } = await params
        const body = await req.json()
        const data = createRecipeRequestSchema.parse(body)
        const recipe = recipeService.createRecipe(householdId, data, req.auth.sub)
        return NextResponse.json({ recipe }, { status: 201 })
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub })
    }
}

export const GET = withAuth(handleGet)
export const POST = withAuth(handlePost)

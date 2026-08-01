import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import { toErrorResponse } from "@/lib/errors/handleRouteError"
import * as recipeService from "@/lib/services/recipeService"
import { addRecipeToShoppingListRequestSchema } from "@basket-bot/core"
import { NextResponse } from "next/server"

async function handlePost(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, recipeId } = await params
        const body = await req.json()
        const data = addRecipeToShoppingListRequestSchema.parse(body)
        const result = recipeService.addRecipeToShoppingList(householdId, recipeId, data, req.auth.sub)
        return NextResponse.json(result)
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub })
    }
}

export const POST = withAuth(handlePost)

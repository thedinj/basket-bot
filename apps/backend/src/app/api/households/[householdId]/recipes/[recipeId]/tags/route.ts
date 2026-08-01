import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import { toErrorResponse } from "@/lib/errors/handleRouteError"
import * as recipeService from "@/lib/services/recipeService"
import { assignTagToRecipeRequestSchema } from "@basket-bot/core"
import { NextResponse } from "next/server"

async function handlePost(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, recipeId } = await params
        const body = await req.json()
        const data = assignTagToRecipeRequestSchema.parse(body)
        const recipe = recipeService.assignTag(householdId, recipeId, data.tagId, req.auth.sub)
        return NextResponse.json({ recipe }, { status: 201 })
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub })
    }
}

export const POST = withAuth(handlePost)

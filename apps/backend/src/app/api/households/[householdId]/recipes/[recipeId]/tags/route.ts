import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import * as householdRepo from "@/lib/repos/householdRepo"
import * as recipeRepo from "@/lib/repos/recipeRepo"
import * as recipeTagRepo from "@/lib/repos/recipeTagRepo"
import { assignTagToRecipeRequestSchema } from "@basket-bot/core"
import { NextResponse } from "next/server"

async function handlePost(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, recipeId } = await params
        if (!householdRepo.userIsMember(householdId, req.auth.sub)) {
            return NextResponse.json({ code: "ACCESS_DENIED", message: "Access denied" }, { status: 403 })
        }
        const recipe = recipeRepo.getRecipeById(recipeId)
        if (!recipe || recipe.householdId !== householdId) {
            return NextResponse.json({ code: "RECIPE_NOT_FOUND", message: "Recipe not found" }, { status: 404 })
        }
        const body = await req.json()
        const data = assignTagToRecipeRequestSchema.parse(body)
        recipeTagRepo.assignTagToRecipe(recipeId, data.tagId)
        const updated = recipeRepo.getRecipeWithDetails(recipeId)
        return NextResponse.json({ recipe: updated }, { status: 201 })
    } catch (error) {
        console.error("Assign tag error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

export const POST = withAuth(handlePost)

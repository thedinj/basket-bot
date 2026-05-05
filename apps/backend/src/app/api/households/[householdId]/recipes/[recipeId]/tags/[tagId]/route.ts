import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import * as householdRepo from "@/lib/repos/householdRepo"
import * as recipeRepo from "@/lib/repos/recipeRepo"
import * as recipeTagRepo from "@/lib/repos/recipeTagRepo"
import { NextResponse } from "next/server"

async function handleDelete(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, recipeId, tagId } = await params
        if (!householdRepo.userIsMember(householdId, req.auth.sub)) {
            return NextResponse.json({ code: "ACCESS_DENIED", message: "Access denied" }, { status: 403 })
        }
        const recipe = recipeRepo.getRecipeById(recipeId)
        if (!recipe || recipe.householdId !== householdId) {
            return NextResponse.json({ code: "RECIPE_NOT_FOUND", message: "Recipe not found" }, { status: 404 })
        }
        recipeTagRepo.removeTagFromRecipe(recipeId, tagId)
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Remove tag error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

export const DELETE = withAuth(handleDelete)

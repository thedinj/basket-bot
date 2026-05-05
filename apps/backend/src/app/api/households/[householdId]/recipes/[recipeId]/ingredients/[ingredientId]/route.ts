import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import * as householdRepo from "@/lib/repos/householdRepo"
import * as recipeIngredientRepo from "@/lib/repos/recipeIngredientRepo"
import * as recipeRepo from "@/lib/repos/recipeRepo"
import { updateRecipeIngredientRequestSchema } from "@basket-bot/core"
import { NextResponse } from "next/server"

function assertAccess(householdId: string, userId: string) {
    if (!householdRepo.userIsMember(householdId, userId)) throw new Error("Access denied")
}

async function handlePatch(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, recipeId, ingredientId } = await params
        assertAccess(householdId, req.auth.sub)
        const recipe = recipeRepo.getRecipeById(recipeId)
        if (!recipe || recipe.householdId !== householdId) {
            return NextResponse.json({ code: "RECIPE_NOT_FOUND", message: "Recipe not found" }, { status: 404 })
        }
        const body = await req.json()
        const data = updateRecipeIngredientRequestSchema.parse(body)
        const ingredient = recipeIngredientRepo.updateIngredient({
            id: ingredientId,
            ...data,
            updatedById: req.auth.sub,
        })
        if (!ingredient) {
            return NextResponse.json({ code: "INGREDIENT_NOT_FOUND", message: "Ingredient not found" }, { status: 404 })
        }
        return NextResponse.json({ ingredient })
    } catch (error: any) {
        if (error.message === "Access denied") {
            return NextResponse.json({ code: "ACCESS_DENIED", message: "Access denied" }, { status: 403 })
        }
        console.error("Update ingredient error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

async function handleDelete(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, recipeId, ingredientId } = await params
        assertAccess(householdId, req.auth.sub)
        const recipe = recipeRepo.getRecipeById(recipeId)
        if (!recipe || recipe.householdId !== householdId) {
            return NextResponse.json({ code: "RECIPE_NOT_FOUND", message: "Recipe not found" }, { status: 404 })
        }
        recipeIngredientRepo.deleteIngredient(ingredientId)
        return NextResponse.json({ success: true })
    } catch (error: any) {
        if (error.message === "Access denied") {
            return NextResponse.json({ code: "ACCESS_DENIED", message: "Access denied" }, { status: 403 })
        }
        console.error("Delete ingredient error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

export const PATCH = withAuth(handlePatch)
export const DELETE = withAuth(handleDelete)

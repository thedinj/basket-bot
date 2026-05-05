import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import * as householdRepo from "@/lib/repos/householdRepo"
import * as recipeRepo from "@/lib/repos/recipeRepo"
import { updateRecipeRequestSchema } from "@basket-bot/core"
import { NextResponse } from "next/server"

function assertAccess(householdId: string, userId: string) {
    if (!householdRepo.userIsMember(householdId, userId)) throw new Error("Access denied")
}

async function handleGet(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, recipeId } = await params
        assertAccess(householdId, req.auth.sub)
        const recipe = recipeRepo.getRecipeWithDetails(recipeId)
        if (!recipe || recipe.householdId !== householdId) {
            return NextResponse.json({ code: "RECIPE_NOT_FOUND", message: "Recipe not found" }, { status: 404 })
        }
        return NextResponse.json({ recipe })
    } catch (error: any) {
        if (error.message === "Access denied") {
            return NextResponse.json({ code: "ACCESS_DENIED", message: "Access denied" }, { status: 403 })
        }
        console.error("Get recipe error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

async function handlePatch(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, recipeId } = await params
        assertAccess(householdId, req.auth.sub)
        const existing = recipeRepo.getRecipeById(recipeId)
        if (!existing || existing.householdId !== householdId) {
            return NextResponse.json({ code: "RECIPE_NOT_FOUND", message: "Recipe not found" }, { status: 404 })
        }
        const body = await req.json()
        const data = updateRecipeRequestSchema.parse(body)
        const recipe = recipeRepo.updateRecipe({ id: recipeId, ...data, updatedById: req.auth.sub })
        return NextResponse.json({ recipe })
    } catch (error: any) {
        if (error.message === "Access denied") {
            return NextResponse.json({ code: "ACCESS_DENIED", message: "Access denied" }, { status: 403 })
        }
        console.error("Update recipe error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

async function handleDelete(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, recipeId } = await params
        assertAccess(householdId, req.auth.sub)
        const existing = recipeRepo.getRecipeById(recipeId)
        if (!existing || existing.householdId !== householdId) {
            return NextResponse.json({ code: "RECIPE_NOT_FOUND", message: "Recipe not found" }, { status: 404 })
        }
        recipeRepo.deleteRecipe(recipeId)
        return NextResponse.json({ success: true })
    } catch (error: any) {
        if (error.message === "Access denied") {
            return NextResponse.json({ code: "ACCESS_DENIED", message: "Access denied" }, { status: 403 })
        }
        console.error("Delete recipe error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

export const GET = withAuth(handleGet)
export const PATCH = withAuth(handlePatch)
export const DELETE = withAuth(handleDelete)

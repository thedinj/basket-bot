import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import * as householdRepo from "@/lib/repos/householdRepo"
import * as recipeRepo from "@/lib/repos/recipeRepo"
import { createRecipeRequestSchema } from "@basket-bot/core"
import { NextResponse } from "next/server"

async function handleGet(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId } = await params
        if (!householdRepo.userIsMember(householdId, req.auth.sub)) {
            return NextResponse.json({ code: "ACCESS_DENIED", message: "Access denied" }, { status: 403 })
        }
        const recipes = recipeRepo.getRecipesWithDetailsByHousehold(householdId)
        return NextResponse.json({ recipes })
    } catch (error) {
        console.error("List recipes error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

async function handlePost(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId } = await params
        if (!householdRepo.userIsMember(householdId, req.auth.sub)) {
            return NextResponse.json({ code: "ACCESS_DENIED", message: "Access denied" }, { status: 403 })
        }
        const body = await req.json()
        const data = createRecipeRequestSchema.parse(body)
        const recipe = recipeRepo.createRecipe({ householdId, ...data, createdById: req.auth.sub })
        return NextResponse.json({ recipe }, { status: 201 })
    } catch (error) {
        console.error("Create recipe error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

export const GET = withAuth(handleGet)
export const POST = withAuth(handlePost)

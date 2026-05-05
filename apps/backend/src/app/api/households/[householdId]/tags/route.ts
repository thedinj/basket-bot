import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import * as householdRepo from "@/lib/repos/householdRepo"
import * as recipeTagRepo from "@/lib/repos/recipeTagRepo"
import { createRecipeTagRequestSchema } from "@basket-bot/core"
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
        const tags = recipeTagRepo.getTagsByHousehold(householdId)
        return NextResponse.json({ tags })
    } catch (error) {
        console.error("List tags error:", error)
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
        const data = createRecipeTagRequestSchema.parse(body)
        const tag = recipeTagRepo.createTag({ householdId, ...data, createdById: req.auth.sub })
        return NextResponse.json({ tag }, { status: 201 })
    } catch (error) {
        console.error("Create tag error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

export const GET = withAuth(handleGet)
export const POST = withAuth(handlePost)

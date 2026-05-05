import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import * as householdRepo from "@/lib/repos/householdRepo"
import * as recipeTagRepo from "@/lib/repos/recipeTagRepo"
import { updateRecipeTagRequestSchema } from "@basket-bot/core"
import { NextResponse } from "next/server"

function assertAccess(householdId: string, userId: string) {
    if (!householdRepo.userIsMember(householdId, userId)) throw new Error("Access denied")
}

async function handlePatch(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, tagId } = await params
        assertAccess(householdId, req.auth.sub)
        const body = await req.json()
        const data = updateRecipeTagRequestSchema.parse(body)
        const tag = recipeTagRepo.updateTag({ id: tagId, ...data })
        if (!tag) {
            return NextResponse.json({ code: "TAG_NOT_FOUND", message: "Tag not found" }, { status: 404 })
        }
        return NextResponse.json({ tag })
    } catch (error: any) {
        if (error.message === "Access denied") {
            return NextResponse.json({ code: "ACCESS_DENIED", message: "Access denied" }, { status: 403 })
        }
        console.error("Update tag error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

async function handleDelete(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, tagId } = await params
        assertAccess(householdId, req.auth.sub)
        recipeTagRepo.deleteTag(tagId)
        return NextResponse.json({ success: true })
    } catch (error: any) {
        if (error.message === "Access denied") {
            return NextResponse.json({ code: "ACCESS_DENIED", message: "Access denied" }, { status: 403 })
        }
        console.error("Delete tag error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

export const PATCH = withAuth(handlePatch)
export const DELETE = withAuth(handleDelete)

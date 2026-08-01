import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import { toErrorResponse } from "@/lib/errors/handleRouteError"
import * as recipeTagService from "@/lib/services/recipeTagService"
import { createRecipeTagRequestSchema } from "@basket-bot/core"
import { NextResponse } from "next/server"

async function handleGet(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId } = await params
        const tags = recipeTagService.listTags(householdId, req.auth.sub)
        return NextResponse.json({ tags })
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
        const data = createRecipeTagRequestSchema.parse(body)
        const tag = recipeTagService.createTag(householdId, data, req.auth.sub)
        return NextResponse.json({ tag }, { status: 201 })
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub })
    }
}

export const GET = withAuth(handleGet)
export const POST = withAuth(handlePost)

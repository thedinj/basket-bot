import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import { toErrorResponse } from "@/lib/errors/handleRouteError"
import * as recipeService from "@/lib/services/recipeService"
import { NextResponse } from "next/server"

async function handleDelete(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, recipeId, tagId } = await params
        recipeService.removeTag(householdId, recipeId, tagId, req.auth.sub)
        return NextResponse.json({ success: true })
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub })
    }
}

export const DELETE = withAuth(handleDelete)

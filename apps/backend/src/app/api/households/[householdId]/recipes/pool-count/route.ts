import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import * as planService from "@/lib/services/planService"
import { NextResponse } from "next/server"

/**
 * GET /api/households/[householdId]/recipes/pool-count?tagIds[]=...
 * Returns the number of recipes matching all specified tag IDs.
 * Used by the plan wizard step 1 to show slot pool counts.
 */
async function handleGet(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId } = await params
        const url = new URL(req.url)
        const tagIds = url.searchParams.getAll("tagIds[]")
        const rawMax = url.searchParams.get("maxCookingTimeMinutes")
        const maxCookingTimeMinutes = rawMax ? parseInt(rawMax, 10) : null
        const count = planService.getPoolCount(householdId, req.auth.sub, tagIds, maxCookingTimeMinutes)
        return NextResponse.json({ count })
    } catch (error: any) {
        if (error.message === "Access denied") {
            return NextResponse.json({ code: "ACCESS_DENIED", message: "Access denied" }, { status: 403 })
        }
        console.error("Pool count error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

export const GET = withAuth(handleGet)

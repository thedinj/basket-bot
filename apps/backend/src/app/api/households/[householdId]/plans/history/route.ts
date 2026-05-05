import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import * as planService from "@/lib/services/planService"
import { NextResponse } from "next/server"

const PAGE_SIZE = 10

async function handleGet(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId } = await params
        const url = new URL(req.url)
        const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10))
        const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? String(PAGE_SIZE), 10)))

        const result = planService.getPlansHistory(householdId, req.auth.sub, limit, offset)
        return NextResponse.json(result)
    } catch (error: any) {
        if (error.message === "Access denied") {
            return NextResponse.json({ code: "ACCESS_DENIED", message: "Access denied" }, { status: 403 })
        }
        console.error("Plan history error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

export const GET = withAuth(handleGet)

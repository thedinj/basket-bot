import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import * as planService from "@/lib/services/planService"
import { NextResponse } from "next/server"

async function handlePost(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, planId } = await params
        const result = planService.dispatchPlan(householdId, planId, req.auth.sub)
        return NextResponse.json(result)
    } catch (error: any) {
        if (error.message === "Access denied") {
            return NextResponse.json({ code: "ACCESS_DENIED", message: "Access denied" }, { status: 403 })
        }
        if (error.message === "Plan not found") {
            return NextResponse.json({ code: "PLAN_NOT_FOUND", message: "Plan not found" }, { status: 404 })
        }
        if (error.message === "Only draft plans can be dispatched") {
            return NextResponse.json({ code: "PLAN_NOT_DRAFT", message: error.message }, { status: 409 })
        }
        console.error("Dispatch plan error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

export const POST = withAuth(handlePost)

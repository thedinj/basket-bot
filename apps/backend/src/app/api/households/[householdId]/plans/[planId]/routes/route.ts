import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import * as planService from "@/lib/services/planService"
import { updateRoutesRequestSchema } from "@basket-bot/core"
import { NextResponse } from "next/server"

async function handlePut(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, planId } = await params
        const body = await req.json()
        const data = updateRoutesRequestSchema.parse(body)
        const plan = planService.updateRoutes(householdId, planId, req.auth.sub, data.routes)
        if (!plan) {
            return NextResponse.json({ code: "PLAN_NOT_FOUND", message: "Plan not found" }, { status: 404 })
        }
        return NextResponse.json({ plan })
    } catch (error: any) {
        if (error.message === "Access denied") {
            return NextResponse.json({ code: "ACCESS_DENIED", message: "Access denied" }, { status: 403 })
        }
        if (error.message === "Only draft plans can be edited") {
            return NextResponse.json({ code: "PLAN_NOT_DRAFT", message: error.message }, { status: 409 })
        }
        console.error("Update plan routes error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

export const PUT = withAuth(handlePut)

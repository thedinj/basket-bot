import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import * as planService from "@/lib/services/planService"
import { createPlanRequestSchema } from "@basket-bot/core"
import { NextResponse } from "next/server"

async function handleGet(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId } = await params
        const plans = planService.getPlansByHousehold(householdId, req.auth.sub)
        return NextResponse.json({ plans })
    } catch (error: any) {
        if (error.message === "Access denied") {
            return NextResponse.json({ code: "ACCESS_DENIED", message: "Access denied" }, { status: 403 })
        }
        console.error("List plans error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

async function handlePost(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId } = await params
        const body = await req.json()
        const data = createPlanRequestSchema.parse(body)
        const plan = planService.createPlan({ householdId, slotCount: data.slotCount, userId: req.auth.sub })
        return NextResponse.json({ plan }, { status: 201 })
    } catch (error: any) {
        if (error.message === "Access denied") {
            return NextResponse.json({ code: "ACCESS_DENIED", message: "Access denied" }, { status: 403 })
        }
        console.error("Create plan error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

export const GET = withAuth(handleGet)
export const POST = withAuth(handlePost)

import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import { toErrorResponse } from "@/lib/errors/handleRouteError"
import * as planService from "@/lib/services/planService"
import { rerollPlanRequestSchema } from "@basket-bot/core"
import { NextResponse } from "next/server"

async function handlePost(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, planId } = await params
        const body = await req.json()
        const data = rerollPlanRequestSchema.parse(body)
        const plan = planService.rerollSlots(householdId, planId, req.auth.sub, data.slots)
        if (!plan) {
            return NextResponse.json({ code: "PLAN_NOT_FOUND", message: "Plan not found" }, { status: 404 })
        }
        return NextResponse.json({ plan })
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub })
    }
}

export const POST = withAuth(handlePost)

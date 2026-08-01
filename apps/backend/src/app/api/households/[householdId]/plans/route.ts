import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import { toErrorResponse } from "@/lib/errors/handleRouteError"
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
        const data = createPlanRequestSchema.parse(body)
        const plan = planService.createPlan({ householdId, slotCount: data.slotCount, userId: req.auth.sub })
        return NextResponse.json({ plan }, { status: 201 })
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub })
    }
}

export const GET = withAuth(handleGet)
export const POST = withAuth(handlePost)

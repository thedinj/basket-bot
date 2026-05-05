import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import * as planService from "@/lib/services/planService"
import { updatePlanRequestSchema } from "@basket-bot/core"
import { NextResponse } from "next/server"

async function handleGet(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, planId } = await params
        const plan = planService.getPlanWithDetails(householdId, planId, req.auth.sub)
        if (!plan) {
            return NextResponse.json({ code: "PLAN_NOT_FOUND", message: "Plan not found" }, { status: 404 })
        }
        return NextResponse.json({ plan })
    } catch (error: any) {
        if (error.message === "Access denied") {
            return NextResponse.json({ code: "ACCESS_DENIED", message: "Access denied" }, { status: 403 })
        }
        console.error("Get plan error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

async function handlePatch(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, planId } = await params
        const body = await req.json()
        const data = updatePlanRequestSchema.parse(body)
        const plan = planService.updatePlan(householdId, planId, req.auth.sub, data)
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
        console.error("Update plan error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

async function handleDelete(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, planId } = await params
        const deleted = planService.deletePlan(householdId, planId, req.auth.sub)
        if (!deleted) {
            return NextResponse.json({ code: "PLAN_NOT_FOUND", message: "Plan not found" }, { status: 404 })
        }
        return NextResponse.json({ success: true })
    } catch (error: any) {
        if (error.message === "Access denied") {
            return NextResponse.json({ code: "ACCESS_DENIED", message: "Access denied" }, { status: 403 })
        }
        if (error.message === "Cannot delete an active plan") {
            return NextResponse.json({ code: "PLAN_ACTIVE", message: error.message }, { status: 409 })
        }
        console.error("Delete plan error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

export const GET = withAuth(handleGet)
export const PATCH = withAuth(handlePatch)
export const DELETE = withAuth(handleDelete)

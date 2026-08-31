import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as planService from "@/lib/services/planService";
import { dispatchPlanRequestSchema, ValidationError } from "@basket-bot/core";
import { NextResponse } from "next/server";

async function handlePost(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, planId } = await params;
        const body = await req.json().catch(() => ({}));
        const parsed = dispatchPlanRequestSchema.safeParse(body);
        if (!parsed.success) {
            throw new ValidationError(parsed.error.errors[0]?.message ?? "Invalid request");
        }
        const result = planService.dispatchPlan(
            householdId,
            planId,
            req.auth.sub,
            parsed.data.scaleFactors
        );
        return NextResponse.json(result);
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const POST = withAuth(handlePost);

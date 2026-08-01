import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import { statsRepository } from "@/lib/repos/statsRepository";
import { NextResponse } from "next/server";

export const GET = withAuth(
    async (req: AuthenticatedRequest) => {
        try {
            const stats = statsRepository.getSystemStats();

            return NextResponse.json(stats);
        } catch (error) {
            return toErrorResponse(error, req, { userId: req.auth.sub });
        }
    },
    { requireScopes: ["admin"] }
);

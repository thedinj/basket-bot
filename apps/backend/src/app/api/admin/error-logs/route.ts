import { withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import { listRecentErrorLogs } from "@/lib/repos/errorLogRepo";
import { NextResponse } from "next/server";

export const GET = withAuth(
    async (req) => {
        try {
            const { searchParams } = req.nextUrl;
            const logs = listRecentErrorLogs({
                limit: Number(searchParams.get("limit")) || 100,
                userId: searchParams.get("userId") ?? undefined,
                route: searchParams.get("route") ?? undefined,
                since: searchParams.get("since") ?? undefined,
            });

            return NextResponse.json({ logs });
        } catch (error) {
            return toErrorResponse(error, req, { userId: req.auth.sub });
        }
    },
    { requireScopes: ["admin"] }
);

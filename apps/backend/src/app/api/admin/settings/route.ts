import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import { getAllAppSettings } from "@/lib/repos/referenceRepo";
import { NextResponse } from "next/server";

export const GET = withAuth(
    async (req: AuthenticatedRequest) => {
        try {
            const settings = getAllAppSettings();

            return NextResponse.json({ settings });
        } catch (error) {
            return toErrorResponse(error, req, { userId: req.auth.sub });
        }
    },
    { requireScopes: ["admin"] }
);

import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import { getAllUsers } from "@/lib/repos/userRepo";
import { NextResponse } from "next/server";

export const GET = withAuth(
    async (req: AuthenticatedRequest) => {
        try {
            const users = getAllUsers();

            return NextResponse.json({ users });
        } catch (error) {
            return toErrorResponse(error, req, { userId: req.auth.sub });
        }
    },
    { requireScopes: ["admin"] }
);

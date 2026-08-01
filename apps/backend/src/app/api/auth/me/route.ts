import { withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import { getUserById } from "@/lib/repos/userRepo";
import { NextResponse } from "next/server";

export const GET = withAuth(async (req) => {
    try {
        // Fetch full user data from database
        const user = getUserById(req.auth.sub);

        if (!user) {
            return NextResponse.json(
                { code: "USER_NOT_FOUND", message: "User not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                scopes: user.scopes,
            },
        });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
});

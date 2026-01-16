import { withAuth } from "@/lib/auth/withAuth";
import { NextResponse } from "next/server";

export const GET = withAuth(async (req) => {
    // User info already attached by withAuth middleware
    const { auth } = req;

    return NextResponse.json({
        user: {
            id: auth.sub,
            email: auth.email || "",
            name: "", // JWT doesn't include name, would need DB lookup if required
            scopes: auth.scopes,
        },
    });
});

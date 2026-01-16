import { withAuth } from "@/lib/auth/withAuth";
import { db } from "@/lib/db/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const logoutRequestSchema = z.object({
    refreshToken: z.string(),
});

export const POST = withAuth(async (req) => {
    try {
        const body = await req.json();
        const { refreshToken } = logoutRequestSchema.parse(body);

        // Delete the refresh token
        const result = db
            .prepare(`DELETE FROM RefreshToken WHERE token = ? AND userId = ?`)
            .run(refreshToken, req.auth.sub);

        if (result.changes === 0) {
            // Token doesn't exist - still return success
            return NextResponse.json({ message: "Logged out successfully" });
        }

        return NextResponse.json({ message: "Logged out successfully" });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { code: "VALIDATION_ERROR", message: "Invalid request body" },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Failed to logout" },
            { status: 500 }
        );
    }
});

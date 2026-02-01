import { withAuth } from "@/lib/auth/withAuth";
import { statsRepository } from "@/lib/repos/statsRepository";
import { NextResponse } from "next/server";

export const GET = withAuth(async () => {
    try {
        const stats = statsRepository.getSystemStats();

        return NextResponse.json(stats);
    } catch (error) {
        console.error("Error fetching stats:", error);
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Failed to fetch system statistics" },
            { status: 500 }
        );
    }
}, { requireScopes: ["admin"] });

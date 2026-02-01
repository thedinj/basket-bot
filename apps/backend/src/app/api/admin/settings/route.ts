import { withAuth } from "@/lib/auth/withAuth";
import { getAllAppSettings } from "@/lib/repos/referenceRepo";
import { NextResponse } from "next/server";

export const GET = withAuth(async () => {
    try {
        const settings = getAllAppSettings();

        return NextResponse.json({ settings });
    } catch (error) {
        console.error("Error fetching settings:", error);
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Failed to fetch settings" },
            { status: 500 }
        );
    }
}, { requireScopes: ["admin"] });

import { withAuth } from "@/lib/auth/withAuth";
import { setAppSetting, getAppSetting } from "@/lib/repos/referenceRepo";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateSettingSchema = z.object({
    value: z.string(),
});

export const PUT = withAuth(async (req: NextRequest, { params }: { params: Promise<Record<string, string>> }) => {
    try {
        const resolvedParams = await params;
        const key = resolvedParams.key;
        const body = await req.json();
        const { value } = updateSettingSchema.parse(body);

        setAppSetting(key, value);
        const updated = getAppSetting(key);

        return NextResponse.json({ setting: updated });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { code: "VALIDATION_ERROR", message: "Invalid request", details: error.errors },
                { status: 400 }
            );
        }

        console.error("Error updating setting:", error);
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Failed to update setting" },
            { status: 500 }
        );
    }
}, { requireScopes: ["admin"] });

import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import { getAppSetting, setAppSetting } from "@/lib/repos/referenceRepo";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSettingSchema = z.object({
    value: z.string(),
});

export const PUT = withAuth(
    async (req: AuthenticatedRequest, { params }: { params: Promise<Record<string, string>> }) => {
        try {
            const resolvedParams = await params;
            const key = resolvedParams.key;
            const body = await req.json();
            const { value } = updateSettingSchema.parse(body);

            setAppSetting(key, value);
            const updated = getAppSetting(key);

            return NextResponse.json({ setting: updated });
        } catch (error) {
            return toErrorResponse(error, req, { userId: req.auth.sub });
        }
    },
    { requireScopes: ["admin"] }
);

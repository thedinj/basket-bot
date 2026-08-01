import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as referenceRepo from "@/lib/repos/referenceRepo";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const setting = referenceRepo.getAppSetting("REGISTRATION_INVITATION_CODE");
        const invitationCode = setting?.value || "";
        const required = Boolean(invitationCode && invitationCode.trim().length > 0);

        return NextResponse.json({ required });
    } catch (error) {
        return toErrorResponse(error, req);
    }
}

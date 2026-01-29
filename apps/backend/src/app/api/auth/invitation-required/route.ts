import * as referenceRepo from "@/lib/repos/referenceRepo";
import { NextResponse } from "next/server";

export async function GET() {
    const setting = referenceRepo.getAppSetting("REGISTRATION_INVITATION_CODE");
    const invitationCode = setting?.value || "";
    const required = Boolean(invitationCode && invitationCode.trim().length > 0);

    return NextResponse.json({ required });
}

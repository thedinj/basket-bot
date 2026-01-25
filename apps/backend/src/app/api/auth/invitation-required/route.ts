import { NextResponse } from "next/server";

export async function GET() {
    const invitationCode = process.env.REGISTRATION_INVITATION_CODE;
    const required = Boolean(invitationCode && invitationCode.trim().length > 0);

    return NextResponse.json({ required });
}

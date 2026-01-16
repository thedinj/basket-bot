import * as referenceRepo from "@/lib/repos/referenceRepo";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const units = referenceRepo.getAllQuantityUnits();
        return NextResponse.json({ units });
    } catch (error: any) {
        return NextResponse.json(
            { code: "INTERNAL_ERROR", message: "Internal server error" },
            { status: 500 }
        );
    }
}

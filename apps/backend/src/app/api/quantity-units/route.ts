import { toErrorResponse } from "@/lib/errors/handleRouteError";
import * as referenceRepo from "@/lib/repos/referenceRepo";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const units = referenceRepo.getAllQuantityUnits();
        return NextResponse.json({ units });
    } catch (error) {
        return toErrorResponse(error, req);
    }
}

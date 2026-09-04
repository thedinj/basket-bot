import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth";
import { getLLMCatalog } from "@/lib/data/llmCatalog";
import { toErrorResponse } from "@/lib/errors/handleRouteError";
import { NextResponse } from "next/server";

/**
 * GET /api/llm/catalog
 * The models the app may use, and which one backs each capability tier by default.
 *
 * The backend makes no LLM calls — it only serves these names, so that changing the model
 * behind a feature is a redeploy rather than an app release. The client falls back to its
 * own bundled defaults when this is unreachable, so a failure here degrades rather than
 * breaking AI features.
 */
async function handleGet(req: AuthenticatedRequest) {
    try {
        return NextResponse.json({ catalog: getLLMCatalog() });
    } catch (error) {
        return toErrorResponse(error, req, { userId: req.auth.sub });
    }
}

export const GET = withAuth(handleGet);

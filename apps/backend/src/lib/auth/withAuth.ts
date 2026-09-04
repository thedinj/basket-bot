import { AuthenticationError, AuthorizationError, JwtPayload } from "@basket-bot/core";
import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "../errors/handleRouteError";
import { verifyAccessToken } from "./jwt";

export type AuthenticatedRequest = NextRequest & {
    auth: JwtPayload;
};

export type RouteHandler<T = unknown> = (
    req: AuthenticatedRequest,
    context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse<T>>;

export function withAuth(handler: RouteHandler, options?: { requireScopes?: string[] }) {
    return async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
        try {
            const authHeader = req.headers.get("authorization");
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                throw new AuthenticationError("Missing or invalid authorization header");
            }

            const token = authHeader.substring(7);
            const payload = verifyAccessToken(token);

            // Check required scopes
            if (options?.requireScopes) {
                const hasRequiredScopes = options.requireScopes.every((scope) =>
                    payload.scopes.includes(scope)
                );
                if (!hasRequiredScopes) {
                    throw new AuthorizationError("Insufficient permissions");
                }
            }

            // Attach auth payload to request
            const authenticatedReq = req as AuthenticatedRequest;
            authenticatedReq.auth = payload;

            // `return await`, not a bare `return`: an async function that returns a promise
            // settles it *after* leaving the try block, so a handler that throws instead of
            // catching would sail straight past this catch and surface as an unmapped 500 with
            // no requestId and no ErrorLog row. Awaiting here keeps the backstop real.
            return await handler(authenticatedReq, context);
        } catch (error) {
            const userId = (req as AuthenticatedRequest).auth?.sub;
            const response = toErrorResponse(error, req, { userId });

            // Add header to help client distinguish token failures
            if (error instanceof AuthenticationError) {
                response.headers.set("X-Token-Status", "invalid");
            }

            return response;
        }
    };
}

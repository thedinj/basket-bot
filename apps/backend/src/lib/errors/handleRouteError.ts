import {
    AppError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    NotFoundError,
    ValidationError,
} from "@basket-bot/core";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { insertErrorLog } from "../repos/errorLogRepo";

/**
 * Shared error-response helper for route handlers.
 * Maps typed AppError subclasses (and a few common untyped error shapes) to a
 * consistent JSON envelope, logs the error (console + ErrorLog table) with the
 * request's correlation ID, and never lets a logging failure break the response.
 */

interface ErrorMapping {
    status: number;
    code: string;
    message: string;
}

function mapError(error: unknown): ErrorMapping {
    if (error instanceof AuthenticationError) {
        return { status: 401, code: error.code, message: error.message };
    }
    if (error instanceof AuthorizationError) {
        return { status: 403, code: error.code, message: error.message };
    }
    if (error instanceof NotFoundError) {
        return { status: 404, code: error.code, message: error.message };
    }
    if (error instanceof ConflictError) {
        return { status: 409, code: error.code, message: error.message };
    }
    if (error instanceof ValidationError) {
        return { status: 400, code: error.code, message: error.message };
    }
    if (error instanceof AppError) {
        return { status: 500, code: error.code, message: error.message };
    }
    if (error instanceof ZodError) {
        return { status: 400, code: "VALIDATION_FAILED", message: "Invalid input" };
    }
    // better-sqlite3 constraint violations (FK/UNIQUE/CHECK) surface as plain
    // objects with a SQLITE_CONSTRAINT* code - never expose the raw DB error.
    if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code: unknown }).code === "string" &&
        (error as { code: string }).code.startsWith("SQLITE_CONSTRAINT")
    ) {
        return {
            status: 409,
            code: "CONFLICT",
            message: "This action conflicts with existing data.",
        };
    }
    return { status: 500, code: "INTERNAL_ERROR", message: "Internal server error" };
}

export function toErrorResponse(
    error: unknown,
    req: NextRequest,
    context?: { userId?: string }
): NextResponse {
    const requestId = req.headers.get("x-request-id") ?? "unknown";
    const { status, code, message } = mapError(error);
    const route = req.nextUrl.pathname;

    logError({
        requestId,
        userId: context?.userId,
        route,
        method: req.method,
        statusCode: status,
        code,
        // Log the original error's message/stack (not the sanitized client message)
        // so unexpected 500s retain full diagnostic detail server-side.
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ code, message, requestId }, { status });
}

interface LogErrorParams {
    requestId: string;
    userId?: string;
    route: string;
    method: string;
    statusCode: number;
    code: string;
    message: string;
    stack?: string;
}

function logError(params: LogErrorParams): void {
    console.error(
        `[${params.requestId}] ${params.method} ${params.route} -> ${params.statusCode} ${params.code}: ${params.message}`,
        params.stack ? `\n${params.stack}` : ""
    );

    try {
        insertErrorLog({
            requestId: params.requestId,
            userId: params.userId ?? null,
            route: params.route,
            method: params.method,
            statusCode: params.statusCode,
            code: params.code,
            message: params.message,
            stack: params.stack ?? null,
        });
    } catch (loggingError) {
        console.error("Failed to persist ErrorLog entry:", loggingError);
    }
}

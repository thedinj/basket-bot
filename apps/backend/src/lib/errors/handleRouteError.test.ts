import {
    AppError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    NotFoundError,
    ValidationError,
} from "@basket-bot/core";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { resetDb } from "../../../test/support/resetDb";
import { db } from "../db/db";
import { toErrorResponse } from "./handleRouteError";

/**
 * Turns the status-code table in `docs/ERROR_HANDLING.md` into assertions.
 *
 * Every route handler funnels its `catch` through `toErrorResponse`, so a wrong mapping here is a
 * wrong status on 64 endpoints at once — and the last time this pattern was rolled out it touched
 * every one of those files.
 */

const request = (headers: Record<string, string> = {}): NextRequest =>
    new NextRequest("https://example.test/api/stores/abc", { method: "POST", headers });

const body = async (error: unknown, headers?: Record<string, string>) => {
    const response = toErrorResponse(error, request(headers));
    return { status: response.status, json: (await response.json()) as Record<string, unknown> };
};

beforeEach(() => {
    resetDb();
    // The mapper logs every error to the console by design; keep the suite output readable.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("status mapping", () => {
    const cases: Array<[string, unknown, number, string]> = [
        ["AuthenticationError", new AuthenticationError("nope"), 401, "AUTHENTICATION_FAILED"],
        [
            "AuthorizationError",
            new AuthorizationError("Access denied"),
            403,
            "AUTHORIZATION_FAILED",
        ],
        ["NotFoundError", new NotFoundError("gone"), 404, "NOT_FOUND"],
        ["ConflictError", new ConflictError("dupe"), 409, "CONFLICT"],
        ["ValidationError", new ValidationError("bad"), 400, "VALIDATION_FAILED"],
    ];

    it.each(cases)("maps %s to %i %s", async (_name, error, status, code) => {
        const result = await body(error);

        expect(result.status).toBe(status);
        expect(result.json.code).toBe(code);
    });

    it("preserves a typed error's own code and message", async () => {
        const { json } = await body(new ConflictError("Aisle exists", "AISLE_NAME_CONFLICT"));

        expect(json.code).toBe("AISLE_NAME_CONFLICT");
        expect(json.message).toBe("Aisle exists");
    });

    it("maps a bare AppError to 500, keeping its code", async () => {
        // AppError's constructor is (code, message) — code first.
        const { status, json } = await body(new AppError("CUSTOM_FAILURE", "boom"));

        expect(status).toBe(500);
        expect(json.code).toBe("CUSTOM_FAILURE");
        expect(json.message).toBe("boom");
    });

    it("maps a ZodError to 400 without leaking the schema", async () => {
        const parsed = z.object({ name: z.string() }).safeParse({ name: 1 });
        expect(parsed.success).toBe(false);

        const { status, json } = await body(parsed.error);

        expect(status).toBe(400);
        expect(json.code).toBe("VALIDATION_FAILED");
        expect(json.message).toBe("Invalid input");
    });

    it("maps an unknown error to a generic 500", async () => {
        const { status, json } = await body(new Error("internal detail"));

        expect(status).toBe(500);
        expect(json.code).toBe("INTERNAL_ERROR");
        // The real message stays server-side; the client gets nothing diagnostic.
        expect(json.message).toBe("Internal server error");
    });

    it("maps a non-Error throw to a generic 500", async () => {
        expect((await body("just a string")).status).toBe(500);
    });
});

describe("SQLite constraint violations", () => {
    it("maps a constraint failure to 409", async () => {
        const sqliteError = Object.assign(
            new Error("UNIQUE constraint failed: StoreItem.nameNorm"),
            {
                code: "SQLITE_CONSTRAINT_UNIQUE",
            }
        );

        const { status, json } = await body(sqliteError);

        expect(status).toBe(409);
        expect(json.code).toBe("CONFLICT");
    });

    /**
     * The raw driver message names tables and columns. It is useful in the server log and must
     * never reach the client.
     */
    it("never leaks the raw database message", async () => {
        const sqliteError = Object.assign(
            new Error("UNIQUE constraint failed: StoreItem.nameNorm"),
            {
                code: "SQLITE_CONSTRAINT_UNIQUE",
            }
        );

        const { json } = await body(sqliteError);

        expect(json.message).toBe("This action conflicts with existing data.");
        expect(JSON.stringify(json)).not.toContain("nameNorm");
    });

    it("covers foreign-key and check constraints too", async () => {
        for (const code of ["SQLITE_CONSTRAINT_FOREIGNKEY", "SQLITE_CONSTRAINT_CHECK"]) {
            const error = Object.assign(new Error("constraint"), { code });
            expect((await body(error)).status).toBe(409);
        }
    });
});

describe("request correlation", () => {
    it("echoes the incoming x-request-id", async () => {
        const { json } = await body(new NotFoundError("gone"), { "x-request-id": "req-123" });

        expect(json.requestId).toBe("req-123");
    });

    it("falls back to 'unknown' when the header is absent", async () => {
        const { json } = await body(new NotFoundError("gone"));

        expect(json.requestId).toBe("unknown");
    });
});

describe("error logging", () => {
    it("persists the failure to the ErrorLog table", async () => {
        await body(new NotFoundError("missing store"), { "x-request-id": "req-abc" });

        const row = db.prepare(`SELECT * FROM ErrorLog WHERE requestId = ?`).get("req-abc") as {
            statusCode: number;
            code: string;
            message: string;
            route: string;
            method: string;
        };

        expect(row.statusCode).toBe(404);
        expect(row.code).toBe("NOT_FOUND");
        expect(row.route).toBe("/api/stores/abc");
        expect(row.method).toBe("POST");
    });

    /**
     * Logs the *original* message even when the client sees a sanitized one, so an unexpected 500
     * is still diagnosable from the ErrorLog table.
     */
    it("records the original message for a sanitized 500", async () => {
        await body(new Error("internal detail"), { "x-request-id": "req-500" });

        const row = db
            .prepare(`SELECT message FROM ErrorLog WHERE requestId = ?`)
            .get("req-500") as {
            message: string;
        };

        expect(row.message).toBe("internal detail");
    });

    // A failure to write the log must never turn a clean 404 into a 500.
    it("still returns the response when logging throws", async () => {
        const { initializeDatabase } = await import("../../db/init");
        db.exec(`DROP TABLE ErrorLog`);

        try {
            const { status } = await body(new NotFoundError("gone"));
            expect(status).toBe(404);
        } finally {
            // Put the table back: `resetDb()` only empties tables, so leaving it dropped would
            // break any test that runs after this one.
            initializeDatabase();
        }
    });
});

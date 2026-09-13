import { describe, expect, it } from "vitest";
import { ApiError } from "../lib/api/client";
import {
    formatErrorMessage,
    getQueueStatusMessage,
    isErrorHandled,
    markErrorHandled,
    shouldQueueError,
} from "./errorUtils";

const apiError = (
    overrides: {
        message?: string;
        code?: string;
        status?: number;
        isNetworkError?: boolean;
    } = {}
): ApiError =>
    new ApiError(
        overrides.message ?? "boom",
        overrides.code,
        null,
        overrides.status,
        overrides.isNetworkError ?? false
    );

describe("formatErrorMessage", () => {
    it("asks the user to check their connection on a network error", () => {
        expect(formatErrorMessage(apiError({ isNetworkError: true }))).toMatch(/connection/i);
    });

    it("calls out a timeout specifically", () => {
        const message = formatErrorMessage(apiError({ isNetworkError: true, code: "TIMEOUT" }));
        expect(message).toMatch(/timed out/i);
    });

    it.each(["SERVER_UNAVAILABLE", "REFRESH_UNREACHABLE"])(
        "blames the server, not the user's connection, for %s",
        (code) => {
            const message = formatErrorMessage(apiError({ isNetworkError: true, code }));
            expect(message).toMatch(/server/i);
            // Telling the user to check a connection that is working sends them the wrong way.
            expect(message).not.toMatch(/check your connection/i);
        }
    );

    it("does not tell the user to log in again when the server was merely unreachable", () => {
        const message = formatErrorMessage(
            apiError({ isNetworkError: true, code: "REFRESH_UNREACHABLE" })
        );
        expect(message).not.toMatch(/log in/i);
    });

    it("tells the user to log in again on an expired session", () => {
        expect(formatErrorMessage(apiError({ code: "SESSION_EXPIRED" }))).toMatch(/log in again/i);
        expect(formatErrorMessage(apiError({ status: 401 }))).toMatch(/log in again/i);
    });

    it("asks the user to wait when rate limited", () => {
        expect(formatErrorMessage(apiError({ status: 429 }))).toMatch(/too many requests/i);
    });

    it("reports server errors with their code", () => {
        expect(formatErrorMessage(apiError({ status: 503, code: "UPSTREAM" }))).toContain(
            "UPSTREAM"
        );
    });

    it("reports a missing resource", () => {
        expect(formatErrorMessage(apiError({ status: 404 }))).toMatch(/not found/i);
    });

    // Validation and business-rule failures carry a message worth showing verbatim, unlike the
    // branches above where the raw server text would be useless to the user.
    it("surfaces the server message for a validation error", () => {
        const message = formatErrorMessage(apiError({ status: 400, message: "Name is required" }));
        expect(message).toBe("Name is required");
    });

    it("prefixes the operation when one is supplied", () => {
        expect(
            formatErrorMessage(apiError({ status: 400, message: "Name is required" }), "save item")
        ).toBe("Failed to save item: Name is required");
    });

    it("handles a plain Error", () => {
        expect(formatErrorMessage(new Error("kaboom"), "save item")).toBe(
            "Failed to save item: kaboom"
        );
    });

    it("handles a non-Error throw", () => {
        expect(formatErrorMessage("just a string")).toBe("An unexpected error occurred");
        expect(formatErrorMessage("just a string", "save item")).toBe("Failed to save item");
    });
});

describe("markErrorHandled / isErrorHandled", () => {
    it("round-trips the handled marker", () => {
        const error = new Error("inline field error");
        expect(isErrorHandled(error)).toBe(false);
        markErrorHandled(error);
        expect(isErrorHandled(error)).toBe(true);
    });

    // The global MutationCache handler calls this on whatever was thrown, so a primitive or
    // null must return false rather than throwing and masking the original failure.
    it("is safe on primitives and nullish values", () => {
        expect(isErrorHandled(null)).toBe(false);
        expect(isErrorHandled(undefined)).toBe(false);
        expect(isErrorHandled("string")).toBe(false);
        expect(isErrorHandled(42)).toBe(false);
        expect(() => markErrorHandled(null)).not.toThrow();
    });

    it("does not leak the marker to other errors", () => {
        const handled = new Error("a");
        markErrorHandled(handled);
        expect(isErrorHandled(new Error("b"))).toBe(false);
    });
});

describe("shouldQueueError", () => {
    it("queues only network failures", () => {
        expect(shouldQueueError(apiError({ isNetworkError: true }))).toBe(true);
        expect(shouldQueueError(apiError({ status: 500 }))).toBe(false);
        expect(shouldQueueError(new Error("nope"))).toBe(false);
    });

    it("queues an edit lost to an unreachable server behind a proxy", () => {
        // The client tags 502/503/504 as network errors precisely so they land here — the
        // server never saw the change, so it is worth replaying.
        expect(
            shouldQueueError(
                apiError({ isNetworkError: true, code: "SERVER_UNAVAILABLE", status: 502 })
            )
        ).toBe(true);
    });
});

describe("getQueueStatusMessage", () => {
    it("says nothing when the queue is empty", () => {
        expect(getQueueStatusMessage(0, false, true)).toBeNull();
    });

    it("pluralizes by queue size", () => {
        expect(getQueueStatusMessage(1, true, true)).toBe("Syncing 1 change...");
        expect(getQueueStatusMessage(3, true, true)).toBe("Syncing 3 changes...");
    });

    it("explains the wait while offline", () => {
        expect(getQueueStatusMessage(2, false, false)).toBe("2 changes will sync when online");
    });

    it("reports a pending queue when online but idle", () => {
        expect(getQueueStatusMessage(2, false, true)).toBe("2 pending changes");
    });
});

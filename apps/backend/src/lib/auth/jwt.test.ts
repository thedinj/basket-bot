import { AuthenticationError } from "@basket-bot/core";
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import {
    generateAccessToken,
    generateRefreshToken,
    getRefreshTokenExpiry,
    verifyAccessToken,
} from "./jwt";

// Matches the values the vitest config puts in the environment.
const SECRET = "test-secret";

const claims = { userId: "user-1", email: "a@b.test", scopes: ["admin"] };

describe("access tokens", () => {
    it("round-trips its claims", () => {
        const decoded = verifyAccessToken(generateAccessToken(claims));

        expect(decoded.sub).toBe("user-1");
        expect(decoded.email).toBe("a@b.test");
        expect(decoded.scopes).toEqual(["admin"]);
    });

    it("stamps the issuer and audience", () => {
        const decoded = verifyAccessToken(generateAccessToken(claims));

        expect(decoded.iss).toBe("basket-bot");
        expect(decoded.aud).toBe("basket-bot-api");
    });

    /**
     * Every rejection path must surface as `AuthenticationError`, not as a raw `jsonwebtoken`
     * error: `toErrorResponse` maps the typed error to a 401, and anything else falls through to
     * a 500. A signature failure that reads as a server error is both wrong and alarming.
     */
    it("rejects a token signed with a different secret", () => {
        const foreign = jwt.sign(
            { sub: "user-1", iss: "basket-bot", aud: "basket-bot-api" },
            "wrong-secret"
        );

        expect(() => verifyAccessToken(foreign)).toThrow(AuthenticationError);
    });

    it("rejects a token from a different issuer", () => {
        const foreign = jwt.sign({ sub: "user-1" }, SECRET, {
            issuer: "somewhere-else",
            audience: "basket-bot-api",
        });

        expect(() => verifyAccessToken(foreign)).toThrow(AuthenticationError);
    });

    it("rejects a token for a different audience", () => {
        const foreign = jwt.sign({ sub: "user-1" }, SECRET, {
            issuer: "basket-bot",
            audience: "someone-else",
        });

        expect(() => verifyAccessToken(foreign)).toThrow(AuthenticationError);
    });

    it("rejects an expired token", () => {
        const expired = jwt.sign({ sub: "user-1" }, SECRET, {
            issuer: "basket-bot",
            audience: "basket-bot-api",
            expiresIn: -10,
        });

        expect(() => verifyAccessToken(expired)).toThrow(AuthenticationError);
    });

    it("rejects garbage", () => {
        expect(() => verifyAccessToken("not-a-token")).toThrow(AuthenticationError);
        expect(() => verifyAccessToken("")).toThrow(AuthenticationError);
    });
});

describe("refresh tokens", () => {
    /**
     * Direct regression test for the collision this function's own comment describes: the JWT it
     * replaced was signed over an empty object, so `{iat, exp}` at one-second resolution was the
     * whole payload and any two tokens minted in the same second were byte-identical — colliding
     * on `UNIQUE(token)` and failing the second concurrent sign-in.
     */
    it("mints distinct tokens within a single tick", () => {
        const tokens = new Set(Array.from({ length: 1000 }, () => generateRefreshToken()));

        expect(tokens.size).toBe(1000);
    });

    it("is 256 bits of base64url", () => {
        const token = generateRefreshToken();

        expect(token).toHaveLength(43);
        expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("is opaque rather than a JWT", () => {
        expect(generateRefreshToken()).not.toContain(".");
    });
});

describe("getRefreshTokenExpiry", () => {
    it("returns a future date", () => {
        expect(getRefreshTokenExpiry().getTime()).toBeGreaterThan(Date.now());
    });
});

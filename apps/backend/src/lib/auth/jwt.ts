import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import { AuthenticationError, JwtPayload } from "@basket-bot/core";
import {
    DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
    DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
} from "@basket-bot/core";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-this";
const JWT_ISSUER = process.env.JWT_ISSUER || "basket-bot";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "basket-bot-api";

const ACCESS_TOKEN_TTL = parseInt(
    process.env.ACCESS_TOKEN_TTL_SECONDS || String(DEFAULT_ACCESS_TOKEN_TTL_SECONDS)
);
const REFRESH_TOKEN_TTL = parseInt(
    process.env.REFRESH_TOKEN_TTL_SECONDS || String(DEFAULT_REFRESH_TOKEN_TTL_SECONDS)
);

export function generateAccessToken(payload: {
    userId: string;
    email: string;
    scopes: string[];
}): string {
    const jwtPayload: Omit<JwtPayload, "iat" | "exp"> = {
        sub: payload.userId,
        email: payload.email,
        scopes: payload.scopes,
        iss: JWT_ISSUER,
        aud: JWT_AUDIENCE,
    };

    return jwt.sign(jwtPayload, JWT_SECRET, {
        expiresIn: ACCESS_TOKEN_TTL,
    });
}

/**
 * Mint an opaque refresh token: 256 bits from the CSPRNG, base64url-encoded (43 chars).
 *
 * Deliberately not a JWT. Refresh tokens are only ever validated by looking the row up in the
 * RefreshToken table — which carries its own `expiresAt` — so nothing ever verified the
 * signature or read the payload. Worse, the JWT this replaced was signed over an *empty* object,
 * leaving `{iat, exp}` at one-second resolution as the entire payload: any two tokens minted in
 * the same second were byte-identical, so concurrent sign-ins collided on the UNIQUE(token)
 * constraint and the second one failed outright.
 */
export function generateRefreshToken(): string {
    return randomBytes(32).toString("base64url");
}

export function verifyAccessToken(token: string): JwtPayload {
    try {
        const decoded = jwt.verify(token, JWT_SECRET, {
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        });
        return decoded as JwtPayload;
    } catch {
        throw new AuthenticationError("Invalid or expired token");
    }
}

export function getRefreshTokenExpiry(): Date {
    return new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);
}

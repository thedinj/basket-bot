// Auth constants
export const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// Role hierarchy
export const ROLE_HIERARCHY = {
    owner: 3,
    editor: 2,
    viewer: 1,
} as const;

// Scopes
export const ADMIN_SCOPE = "admin";

/**
 * Text column length limits
 *
 * These constants define maximum character lengths for text fields across the application.
 * Used in both Zod schema validation (application layer) and SQLite CHECK constraints (database layer).
 *
 * Note: These are CHARACTER counts, not byte lengths, to properly handle Unicode/emoji.
 * Both Zod's .max() and SQLite's length() count characters, not bytes.
 */

// User-facing content limits
export const MAX_NAME_LENGTH = 100; // Names: users, households, stores, aisles, sections, items
export const MAX_EMAIL_LENGTH = 255; // Email addresses
export const MAX_NOTES_LENGTH = 1000; // Shopping list item notes and descriptions

// System field limits
export const MAX_ROLE_LENGTH = 50; // Role enums (owner/editor)
export const MAX_TOKEN_LENGTH = 255; // Refresh tokens, invitation tokens
export const MAX_PASSWORD_HASH_LENGTH = 255; // Bcrypt hashes (~60 chars, buffer for future algorithms)
export const MAX_SCOPES_LENGTH = 500; // JSON array of scope strings
export const MAX_SETTING_KEY_LENGTH = 100; // AppSetting keys
export const MAX_SETTING_VALUE_LENGTH = 1000; // AppSetting values (JSON config)

// QuantityUnit limits (static seed data)
export const MAX_UNIT_NAME_LENGTH = 50;
export const MAX_UNIT_ABBREVIATION_LENGTH = 10;
export const MAX_UNIT_CATEGORY_LENGTH = 50;

// Status field limits
export const MAX_STATUS_LENGTH = 50; // Invitation status enum (pending/accepted/rejected)

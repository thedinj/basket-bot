import pluralize from "pluralize";
import { z } from "zod";

/**
 * Server-controlled provenance columns carried by every auditable entity.
 *
 * Spread into a schema's shape (`...auditFields`). Defined once here because these four fields
 * must stay identical across every entity — they were previously declared separately in each
 * schema module, which is exactly the kind of drift this package exists to prevent.
 */
export const auditFields = {
    createdById: z.string().uuid(),
    updatedById: z.string().uuid(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
};

/**
 * Create a Zod string schema with max length validation and custom error message
 *
 * @param maxLength - Maximum number of characters allowed
 * @param fieldName - Human-readable field name for error messages (e.g., "Name", "Email")
 * @returns Zod string schema with max length constraint
 *
 * @example
 * const nameSchema = maxLengthString(MAX_NAME_LENGTH, "Name");
 * // Validates and shows: "Name must be 100 characters or less"
 */
export function maxLengthString(maxLength: number, fieldName: string) {
    return z.string().max(maxLength, {
        message: `${fieldName} must be ${maxLength} characters or less`,
    });
}

/**
 * Create a Zod string schema with min and max length validation and custom error messages
 *
 * @param minLength - Minimum number of characters required
 * @param maxLength - Maximum number of characters allowed
 * @param fieldName - Human-readable field name for error messages
 * @returns Zod string schema with min and max length constraints
 *
 * @example
 * const nameSchema = minMaxLengthString(1, MAX_NAME_LENGTH, "Name");
 * // Validates and shows appropriate min/max error messages
 */
export function minMaxLengthString(minLength: number, maxLength: number, fieldName: string) {
    return z
        .string()
        .min(minLength, {
            message: `${fieldName} must be at least ${minLength} ${pluralize("character", minLength)}`,
        })
        .max(maxLength, {
            message: `${fieldName} must be ${maxLength} characters or less`,
        });
}

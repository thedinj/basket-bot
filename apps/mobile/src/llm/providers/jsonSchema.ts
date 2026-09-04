/**
 * JSON Schema normalization for providers that constrain output to a schema.
 *
 * Structured-output schemas accept only a subset of JSON Schema: no numeric or string
 * constraints, no array-length constraints, and every object must declare
 * `additionalProperties: false`. `zod-to-json-schema` happily emits the unsupported
 * keywords, so strip them here rather than at each call site. Dropping a constraint is
 * safe — `runLLM` still validates the response against the full Zod schema afterwards.
 */

/** Keywords the structured-output schema compiler rejects. */
const UNSUPPORTED_KEYWORDS = new Set([
    "$schema",
    "default",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "multipleOf",
    "minLength",
    "maxLength",
    "pattern",
    "minItems",
    "maxItems",
    "uniqueItems",
    "minProperties",
    "maxProperties",
]);

/**
 * Recursively strip unsupported keywords and force `additionalProperties: false`
 * on every object node.
 */
export const toStructuredOutputSchema = (schema: unknown): unknown => {
    if (Array.isArray(schema)) {
        return schema.map(toStructuredOutputSchema);
    }
    if (typeof schema !== "object" || schema === null) {
        return schema;
    }

    const source = schema as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(source)) {
        if (UNSUPPORTED_KEYWORDS.has(key)) continue;
        result[key] = toStructuredOutputSchema(value);
    }

    if (result.type === "object" || result.properties !== undefined) {
        result.additionalProperties = false;
    }

    return result;
};

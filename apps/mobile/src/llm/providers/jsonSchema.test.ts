/**
 * Structured-output schema compilers reject constraint keywords that `zod-to-json-schema`
 * emits freely. A single leftover `minLength` fails the whole request with a 400, so this
 * covers the strip-and-normalize step that keeps generated schemas acceptable.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { toStructuredOutputSchema } from "./jsonSchema";

const flatten = (value: unknown): string => JSON.stringify(value);

describe("toStructuredOutputSchema", () => {
    it("strips constraint keywords at every depth", () => {
        const cleaned = toStructuredOutputSchema({
            type: "object",
            properties: {
                items: {
                    type: "array",
                    minItems: 1,
                    items: { type: "string", minLength: 2, maxLength: 5, pattern: "^a" },
                },
                count: { type: "number", minimum: 0, maximum: 10, multipleOf: 2 },
            },
        });

        const serialized = flatten(cleaned);
        for (const keyword of [
            "minItems",
            "minLength",
            "maxLength",
            "pattern",
            "minimum",
            "maximum",
            "multipleOf",
        ]) {
            expect(serialized).not.toContain(keyword);
        }
    });

    it("forces additionalProperties: false on nested objects", () => {
        const cleaned = toStructuredOutputSchema({
            type: "object",
            properties: {
                inner: { type: "object", properties: { a: { type: "string" } } },
            },
        }) as Record<string, never>;

        expect(cleaned).toMatchObject({
            additionalProperties: false,
            properties: { inner: { additionalProperties: false } },
        });
    });

    it("drops $schema, which the compiler rejects", () => {
        const generated = zodToJsonSchema(z.object({ name: z.string().min(1) }));
        expect(flatten(generated)).toContain("$schema");
        expect(flatten(toStructuredOutputSchema(generated))).not.toContain("$schema");
    });

    it("leaves the structure of a real feature schema intact", () => {
        const cleaned = toStructuredOutputSchema(
            zodToJsonSchema(z.object({ aisles: z.array(z.object({ name: z.string() })) }))
        ) as { properties: { aisles: { type: string } } };

        expect(cleaned.properties.aisles.type).toBe("array");
    });
});

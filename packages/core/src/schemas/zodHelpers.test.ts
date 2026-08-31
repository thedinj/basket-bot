import { describe, expect, it } from "vitest";
import { z } from "zod";
import { auditFields, maxLengthString, minMaxLengthString } from "./zodHelpers.js";

describe("auditFields", () => {
    const schema = z.object({ id: z.string(), ...auditFields });

    const valid = {
        id: "anything",
        createdById: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
        updatedById: "3f2504e0-4f89-41d3-9a0c-0305e82c3302",
        createdAt: "2026-03-15T09:00:00.000Z",
        updatedAt: "2026-03-15T09:00:00.000Z",
    };

    it("accepts uuid ids and ISO datetimes", () => {
        expect(schema.parse(valid)).toEqual(valid);
    });

    it("rejects a non-uuid actor id", () => {
        expect(() => schema.parse({ ...valid, createdById: "not-a-uuid" })).toThrow();
    });

    it("rejects a date-only string for a datetime field", () => {
        expect(() => schema.parse({ ...valid, updatedAt: "2026-03-15" })).toThrow();
    });

    it("requires every audit field", () => {
        for (const key of Object.keys(auditFields)) {
            const { [key]: _omitted, ...rest } = valid as Record<string, unknown>;
            expect(() => schema.parse(rest), `missing ${key} should fail`).toThrow();
        }
    });
});

describe("maxLengthString", () => {
    const schema = maxLengthString(5, "Name");

    it("accepts a string at the limit", () => {
        expect(schema.parse("12345")).toBe("12345");
    });

    it("names the field and limit in the error", () => {
        const result = schema.safeParse("123456");
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe("Name must be 5 characters or less");
        }
    });
});

describe("minMaxLengthString", () => {
    const schema = minMaxLengthString(2, 4, "Code");

    it("accepts values within the range", () => {
        expect(schema.parse("ab")).toBe("ab");
        expect(schema.parse("abcd")).toBe("abcd");
    });

    it("pluralizes the minimum correctly", () => {
        const plural = minMaxLengthString(2, 4, "Code").safeParse("a");
        expect(plural.success).toBe(false);
        if (!plural.success) {
            expect(plural.error.issues[0].message).toBe("Code must be at least 2 characters");
        }

        const singular = minMaxLengthString(1, 4, "Code").safeParse("");
        expect(singular.success).toBe(false);
        if (!singular.success) {
            expect(singular.error.issues[0].message).toBe("Code must be at least 1 character");
        }
    });

    it("still enforces the maximum", () => {
        expect(schema.safeParse("abcde").success).toBe(false);
    });
});

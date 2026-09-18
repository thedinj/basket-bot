import { describe, expect, it, vi } from "vitest";
import {
    aislesNeedingEmoji,
    matchAisleEmoji,
    suggestAisleEmoji,
    suggestEmojiForAisleName,
} from "./aisleEmoji";

const aisle = (id: string, name: string, emoji: string | null = null) => ({ id, name, emoji });

describe("aislesNeedingEmoji", () => {
    it("keeps named aisles without an emoji", () => {
        expect(aislesNeedingEmoji([aisle("a", "Produce")]).map((a) => a.id)).toEqual(["a"]);
    });

    // Their plate is the "AISLE 3" sign; an emoji would replace it.
    it("skips number-only aisles", () => {
        expect(aislesNeedingEmoji([aisle("a", "Aisle 3"), aisle("b", "12")])).toEqual([]);
    });

    it("keeps an aisle with a number and a name", () => {
        expect(aislesNeedingEmoji([aisle("a", "7 - Baking")])).toHaveLength(1);
    });

    // A suggestion must never overwrite the user's own choice.
    it("skips aisles that already have an emoji", () => {
        expect(aislesNeedingEmoji([aisle("a", "Deli", "🧀")])).toEqual([]);
    });
});

describe("matchAisleEmoji", () => {
    const candidates = [aisle("a", "Produce"), aisle("b", "Deli")];

    it("matches answers back to aisles by name, ignoring case", () => {
        const result = matchAisleEmoji(
            {
                aisles: [
                    { name: "produce", emoji: "🥬" },
                    { name: "Deli", emoji: "🧀" },
                ],
            },
            candidates
        );

        expect(result).toEqual([
            { aisleId: "a", name: "Produce", emoji: "🥬" },
            { aisleId: "b", name: "Deli", emoji: "🧀" },
        ]);
    });

    it("drops invented names, nulls, and answers that aren't one emoji", () => {
        const result = matchAisleEmoji(
            {
                aisles: [
                    { name: "Produce", emoji: "lettuce" },
                    { name: "Deli", emoji: null },
                    { name: "Bakery", emoji: "🥖" },
                ],
            },
            candidates
        );

        expect(result).toEqual([]);
    });
});

describe("suggestAisleEmoji", () => {
    it("does not call the model when no aisle needs an emoji", async () => {
        const runModel = vi.fn();

        const result = await suggestAisleEmoji(
            [aisle("a", "Aisle 3"), aisle("b", "Deli", "🧀")],
            runModel
        );

        expect(result).toEqual([]);
        expect(runModel).not.toHaveBeenCalled();
    });

    it("asks only about the aisles that need one", async () => {
        const runModel = vi.fn().mockResolvedValue({ aisles: [{ name: "Produce", emoji: "🥬" }] });

        const result = await suggestAisleEmoji(
            [aisle("a", "Produce"), aisle("b", "Aisle 3"), aisle("c", "Deli", "🧀")],
            runModel
        );

        expect(JSON.parse(runModel.mock.calls[0][0])).toEqual({ aisles: ["Produce"] });
        expect(result).toEqual([{ aisleId: "a", name: "Produce", emoji: "🥬" }]);
    });
});

describe("suggestEmojiForAisleName", () => {
    it.each(["", "   ", "Aisle 3", "12"])("does not call the model for %j", async (name) => {
        const runModel = vi.fn();

        expect(await suggestEmojiForAisleName(name, runModel)).toBeNull();
        expect(runModel).not.toHaveBeenCalled();
    });

    it("returns the model's emoji for the name", async () => {
        const runModel = vi.fn().mockResolvedValue({ aisles: [{ name: "Deli", emoji: "🧀" }] });

        expect(await suggestEmojiForAisleName(" Deli ", runModel)).toBe("🧀");
        expect(JSON.parse(runModel.mock.calls[0][0])).toEqual({ aisles: ["Deli"] });
    });

    it("returns null when the answer isn't one emoji", async () => {
        const runModel = vi.fn().mockResolvedValue({ aisles: [{ name: "Deli", emoji: "cheese" }] });

        expect(await suggestEmojiForAisleName("Deli", runModel)).toBeNull();
    });
});

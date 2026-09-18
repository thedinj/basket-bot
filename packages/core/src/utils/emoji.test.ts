import { describe, expect, it } from "vitest";
import { isSingleEmoji, toSingleEmojiOrNull } from "./emoji";

describe("isSingleEmoji", () => {
    it.each(["🥬", "🧀", "🍷", " 🥩 ", "🧑‍🍳", "🇺🇸", "👍🏽", "❄️"])("accepts %j", (value) => {
        expect(isSingleEmoji(value)).toBe(true);
    });

    it.each(["", " ", "A", "3", "Produce", "🥬🧀", "🥬 produce", "leafy_greens"])(
        "rejects %j",
        (value) => {
            expect(isSingleEmoji(value)).toBe(false);
        }
    );
});

describe("toSingleEmojiOrNull", () => {
    it("trims a valid emoji", () => {
        expect(toSingleEmojiOrNull(" 🥖 ")).toBe("🥖");
    });

    it("drops anything else", () => {
        expect(toSingleEmojiOrNull("bread")).toBeNull();
        expect(toSingleEmojiOrNull(null)).toBeNull();
        expect(toSingleEmojiOrNull(undefined)).toBeNull();
    });
});

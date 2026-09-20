import { beforeEach, describe, expect, it } from "vitest";
import { INTERACTION_QUIET_MS, interactionGate } from "./interactionGate";

describe("interactionGate", () => {
    beforeEach(() => {
        interactionGate.reset();
    });

    it("is inactive on a screen nobody has touched", () => {
        expect(interactionGate.isActive(1_000)).toBe(false);
    });

    it("is active while a pointer is down, however long it stays down", () => {
        interactionGate.pointerDown(1_000);

        expect(interactionGate.isActive(1_000)).toBe(true);
        expect(interactionGate.isActive(1_000 + INTERACTION_QUIET_MS * 100)).toBe(true);
    });

    it("stays active for the quiet period after the pointer lifts, then clears", () => {
        interactionGate.pointerDown(1_000);
        interactionGate.pointerUp(1_200);

        expect(interactionGate.isActive(1_200 + INTERACTION_QUIET_MS - 1)).toBe(true);
        expect(interactionGate.isActive(1_200 + INTERACTION_QUIET_MS)).toBe(false);
    });

    // A second finger landing and lifting must not report the hand as gone.
    it("counts pointers rather than flagging them", () => {
        interactionGate.pointerDown(1_000);
        interactionGate.pointerDown(1_050);
        interactionGate.pointerUp(1_100);

        expect(interactionGate.isActive(1_100 + INTERACTION_QUIET_MS * 10)).toBe(true);

        interactionGate.pointerUp(1_200);

        expect(interactionGate.isActive(1_200 + INTERACTION_QUIET_MS)).toBe(false);
    });

    it("counts a scroll as use", () => {
        interactionGate.note(5_000);

        expect(interactionGate.isActive(5_000 + INTERACTION_QUIET_MS - 1)).toBe(true);
    });
});

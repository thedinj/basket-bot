import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { formatSnoozeDate, formatSnoozeDateForStorage, isCurrentlySnoozed } from "./dateUtils";

// A snooze is a *calendar date*, not an instant. Every function here exists to keep that true
// regardless of where the user is, so the whole suite re-runs under three offsets:
// UTC-8, UTC, and UTC+14 (Kiritimati) — the extreme that catches the classic
// "compared a local getDate() against a UTC date part" bug.
const TIMEZONES = ["UTC", "America/Los_Angeles", "Pacific/Kiritimati"];

const pad = (n: number): string => String(n).padStart(2, "0");

/** The current *local* calendar date, formatted the way stored snooze dates are. */
const localToday = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** A stored snooze value `days` away from the user's local today. */
const snoozeFor = (days: number): string => {
    const [y, m, d] = localToday().split("-").map(Number);
    return `${new Date(Date.UTC(y, m - 1, d + days)).toISOString().split("T")[0]}T00:00:00.000Z`;
};

describe.each(TIMEZONES)("in %s", (tz) => {
    const originalTz = process.env.TZ;

    beforeAll(() => {
        process.env.TZ = tz;
    });
    afterAll(() => {
        process.env.TZ = originalTz;
    });

    describe("isCurrentlySnoozed", () => {
        // Mid-afternoon UTC, deliberately not midnight: in Kiritimati (UTC+14) this instant is
        // already the *next* calendar day, which is exactly the skew that breaks a naive
        // implementation.
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        it("is false when nothing is snoozed", () => {
            expect(isCurrentlySnoozed(null)).toBe(false);
        });

        it("is false once the snooze date has passed", () => {
            expect(isCurrentlySnoozed(snoozeFor(-1))).toBe(false);
        });

        // The boundary the doc comment promises: an item snoozed until today is visible today.
        it("is false on the snooze date itself", () => {
            expect(isCurrentlySnoozed(snoozeFor(0))).toBe(false);
        });

        it("is true while the snooze date is still ahead", () => {
            expect(isCurrentlySnoozed(snoozeFor(1))).toBe(true);
        });

        // Pins the semantics the offsets above are relative to: "today" is the user's local
        // calendar day, not the UTC one. At 12:00Z a Kiritimati user is already on 2026-03-16,
        // so a 2026-03-16 snooze has correctly expired for them and not for a UTC user.
        it("resolves 'today' against the user's local calendar date", () => {
            const expiredInKiritimatiOnly = "2026-03-16T00:00:00.000Z";
            expect(isCurrentlySnoozed(expiredInKiritimatiOnly)).toBe(tz !== "Pacific/Kiritimati");
        });
    });

    describe("formatSnoozeDateForStorage", () => {
        it("normalizes a date-only string to UTC midnight", () => {
            expect(formatSnoozeDateForStorage("2026-01-25")).toBe("2026-01-25T00:00:00.000Z");
        });

        it("keeps the calendar date when given an offset datetime", () => {
            expect(formatSnoozeDateForStorage("2026-01-25T14:30:00-08:00")).toBe(
                "2026-01-25T00:00:00.000Z"
            );
        });
    });

    describe("formatSnoozeDate", () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        // The whole point of the split-on-"T" parsing: the stored UTC midnight must not slide
        // back a day when rendered west of Greenwich, or forward when rendered east of it.
        it("renders the stored calendar date, not a timezone-shifted one", () => {
            expect(formatSnoozeDate("2026-01-25T00:00:00.000Z")).toContain("25");
            expect(formatSnoozeDate("2026-01-25T00:00:00.000Z")).toContain("Jan");
        });

        it("includes the year only when it differs from the current one", () => {
            expect(formatSnoozeDate("2026-03-20T00:00:00.000Z")).not.toContain("2026");
            expect(formatSnoozeDate("2027-03-20T00:00:00.000Z")).toContain("2027");
        });
    });
});

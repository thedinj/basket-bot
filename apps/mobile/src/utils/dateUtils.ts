/**
 * Formats a date in a user-friendly short format.
 * Shows month abbreviation and day (e.g., "Jan 5").
 * Includes year only if different from current year (e.g., "Jan 5, 2027").
 *
 * @param date - The date to format
 * @returns Formatted date string (e.g., "Jan 5" or "Jan 5, 2027")
 */
export const formatShortDate = (date: Date | string): string => {
    const dateObj = typeof date === "string" ? new Date(date) : date;

    return dateObj.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: dateObj.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
};

/**
 * Formats a snooze date for display in the UI.
 * Shows month abbreviation and day (e.g., "Jan 22").
 * Includes year only if different from current year.
 *
 * Extracts the date portion to avoid timezone conversion issues.
 * A snooze date stored as "2026-01-25T00:00:00.000Z" will display as "Jan 25" regardless of user's timezone.
 *
 * @param snoozedUntil - ISO datetime string from database (e.g., "2026-01-25T00:00:00.000Z")
 * @returns Formatted date string (e.g., "Jan 22" or "Jan 22, 2027")
 */
export const formatSnoozeDate = (snoozedUntil: string): string => {
    // Extract date portion (YYYY-MM-DD) to avoid timezone conversion
    const datePart = snoozedUntil.split("T")[0];
    // Parse as local date by appending time component
    const dateObj = new Date(datePart + "T00:00:00");
    return formatShortDate(dateObj);
};

/**
 * Normalizes a date string to midnight UTC, stripping any time/timezone information.
 * This ensures consistent date-only comparisons regardless of user's timezone.
 *
 * When a user selects "tomorrow" on a calendar, we want to store "the start of that day in UTC"
 * rather than a specific point in time that varies by timezone.
 *
 * @param dateString - ISO date string (can be date-only like "2026-01-25" or full datetime)
 * @returns ISO datetime string normalized to midnight UTC (e.g., "2026-01-25T00:00:00.000Z")
 *
 * @example
 * formatSnoozeDateForStorage("2026-01-25") // "2026-01-25T00:00:00.000Z"
 * formatSnoozeDateForStorage("2026-01-25T14:30:00-08:00") // "2026-01-25T00:00:00.000Z"
 */
export const formatSnoozeDateForStorage = (dateString: string): string => {
    // Extract just the date portion (YYYY-MM-DD) to avoid timezone interpretation
    const datePart = dateString.split("T")[0];
    // Manually construct UTC midnight datetime
    return `${datePart}T00:00:00.000Z`;
};

/**
 * Checks if an item is currently snoozed (snooze date is in the future).
 * Uses date-only comparison (ignores time) to ensure consistent behavior across timezones.
 *
 * An item snoozed until "Jan 25" becomes visible at the start of Jan 25.
 * It remains hidden before Jan 25, and becomes visible on Jan 25 and after.
 *
 * @param snoozedUntil - ISO datetime string from database, or null
 * @returns true if item is snoozed (date > today), false otherwise
 *
 * @example
 * // Current date: Jan 24, 2026
 * isCurrentlySnoozed("2026-01-25T00:00:00.000Z") // true (snoozed until tomorrow - still hidden)
 * isCurrentlySnoozed("2026-01-24T00:00:00.000Z") // false (snoozed until today - visible now)
 * isCurrentlySnoozed("2026-01-23T00:00:00.000Z") // false (snooze expired)
 */
export const isCurrentlySnoozed = (snoozedUntil: string | null): boolean => {
    if (!snoozedUntil) return false;

    // Extract date portions only (YYYY-MM-DD) to compare calendar dates
    const snoozeDate = snoozedUntil.split("T")[0];
    // Get today's date in local timezone, formatted as YYYY-MM-DD
    const today = new Date();
    const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    // Item is snoozed if snooze date is AFTER today (becomes visible ON the snooze date)
    return snoozeDate > todayDate;
};

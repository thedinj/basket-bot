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
        year:
            dateObj.getFullYear() !== new Date().getFullYear()
                ? "numeric"
                : undefined,
    });
};

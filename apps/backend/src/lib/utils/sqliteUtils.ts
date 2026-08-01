export function boolToInt(value: boolean | null | undefined): number | null {
    return value ? 1 : null;
}

export function intToBool(value: number | null | undefined): boolean {
    return value === 1;
}

/**
 * Parses a datetime column value into a correct Date instant.
 *
 * SQLite's CURRENT_TIMESTAMP / datetime('now') defaults produce UTC time formatted
 * as "YYYY-MM-DD HH:MM:SS" with no timezone marker. `new Date(...)` on that exact
 * format is parsed as LOCAL time by JS engines (not UTC), silently producing the
 * wrong instant. The app-level convention is to always write timestamps explicitly
 * via `new Date().toISOString()` (which already parses correctly), but this handles
 * the raw-SQLite-default format too as a safety net for older rows or any insert
 * that still relies on the column default.
 */
export function parseSqliteTimestamp(value: string): Date {
    const isoString = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
    return new Date(isoString);
}

import type { AppSetting, QuantityUnit } from "@basket-bot/core";
import { db } from "../db/db";

/**
 * Repository for reference data (QuantityUnits, AppSettings).
 */

export function getAllQuantityUnits(): QuantityUnit[] {
    return db
        .prepare(
            `SELECT id, name, abbreviation, sortOrder, category
             FROM QuantityUnit
             ORDER BY sortOrder ASC`
        )
        .all() as QuantityUnit[];
}

export function getAppSetting(key: string): AppSetting | null {
    const row = db
        .prepare(
            `SELECT key, value, createdAt, updatedAt
             FROM AppSetting
             WHERE key = ?`
        )
        .get(key) as AppSetting | undefined;

    return row ?? null;
}

export function setAppSetting(key: string, value: string): void {
    const now = new Date().toISOString();
    const existing = getAppSetting(key);

    if (existing) {
        db.prepare(`UPDATE AppSetting SET value = ?, updatedAt = ? WHERE key = ?`).run(
            value,
            now,
            key
        );
    } else {
        db.prepare(
            `INSERT INTO AppSetting (key, value, createdAt, updatedAt) VALUES (?, ?, ?, ?)`
        ).run(key, value, now, now);
    }
}

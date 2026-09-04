import type { Database } from "better-sqlite3";

/**
 * Migration: recreate three indexes that earlier table rebuilds silently dropped.
 *
 * SQLite cannot alter a table's constraints in place, so several migrations rebuild a table by
 * creating `X_new`, copying the rows, dropping `X`, and renaming. Dropping a table also drops
 * every index on it, and these three were never recreated afterwards:
 *
 *   - `HouseholdInvitation_token_idx` and `HouseholdInvitation_invitedEmail_status_idx`, lost when
 *     `20260202_000000_add_text_length_constraints` rebuilt `HouseholdInvitation`
 *   - `RecipeTag_householdId_name_idx`, lost when `20260504_120000_rename_tag_color_to_colorkey`
 *     rebuilt `RecipeTag`
 *
 * `init.ts` still creates all three, so fresh installs have always had them and only upgraded
 * databases were missing them — invitation lookups by token and by (email, status) were running as
 * full scans there. This closes that gap, and `migrationDrift.test.ts` now fails if a rebuild ever
 * drops an index again.
 */

export function up(db: Database): void {
    db.exec(`
        CREATE INDEX IF NOT EXISTS "HouseholdInvitation_token_idx"
            ON "HouseholdInvitation"("token");

        CREATE INDEX IF NOT EXISTS "HouseholdInvitation_invitedEmail_status_idx"
            ON "HouseholdInvitation"("invitedEmail", "status");

        CREATE INDEX IF NOT EXISTS "RecipeTag_householdId_name_idx"
            ON "RecipeTag"("householdId", "name");
    `);

    console.log("  ✓ Restored indexes dropped by earlier table rebuilds");
}

export function down(db: Database): void {
    db.exec(`
        DROP INDEX IF EXISTS "HouseholdInvitation_token_idx";
        DROP INDEX IF EXISTS "HouseholdInvitation_invitedEmail_status_idx";
        DROP INDEX IF EXISTS "RecipeTag_householdId_name_idx";
    `);

    console.log("  ✓ Dropped restored indexes");
}

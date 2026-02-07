import type { Database } from "better-sqlite3";

export function up(db: Database): void {
    db.exec(`
        PRAGMA foreign_keys = OFF;

        CREATE TABLE "HouseholdMember_new" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "householdId" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
            UNIQUE ("householdId", "userId")
        );

        INSERT INTO "HouseholdMember_new" ("id", "householdId", "userId", "createdAt")
        SELECT "id", "householdId", "userId", "createdAt"
        FROM "HouseholdMember";

        DROP TABLE "HouseholdMember";
        ALTER TABLE "HouseholdMember_new" RENAME TO "HouseholdMember";

        CREATE TABLE "HouseholdInvitation_new" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "householdId" TEXT NOT NULL,
            "invitedEmail" TEXT NOT NULL COLLATE NOCASE CHECK(length("invitedEmail") <= 255),
            "invitedById" TEXT NOT NULL,
            "token" TEXT NOT NULL UNIQUE CHECK(length("token") <= 255),
            "status" TEXT NOT NULL DEFAULT 'pending' CHECK(length("status") <= 50),
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE CASCADE
        );

        INSERT INTO "HouseholdInvitation_new" (
            "id",
            "householdId",
            "invitedEmail",
            "invitedById",
            "token",
            "status",
            "createdAt"
        )
        SELECT
            "id",
            "householdId",
            "invitedEmail",
            "invitedById",
            "token",
            "status",
            "createdAt"
        FROM "HouseholdInvitation";

        DROP TABLE "HouseholdInvitation";
        ALTER TABLE "HouseholdInvitation_new" RENAME TO "HouseholdInvitation";

        PRAGMA foreign_keys = ON;
    `);
}

export function down(db: Database): void {
    db.exec(`
        PRAGMA foreign_keys = OFF;

        CREATE TABLE "HouseholdMember_new" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "householdId" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "role" TEXT NOT NULL CHECK(length("role") <= 50),
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
            UNIQUE ("householdId", "userId")
        );

        INSERT INTO "HouseholdMember_new" ("id", "householdId", "userId", "role", "createdAt")
        SELECT "id", "householdId", "userId", 'owner', "createdAt"
        FROM "HouseholdMember";

        DROP TABLE "HouseholdMember";
        ALTER TABLE "HouseholdMember_new" RENAME TO "HouseholdMember";

        CREATE TABLE "HouseholdInvitation_new" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "householdId" TEXT NOT NULL,
            "invitedEmail" TEXT NOT NULL COLLATE NOCASE CHECK(length("invitedEmail") <= 255),
            "invitedById" TEXT NOT NULL,
            "role" TEXT NOT NULL CHECK(length("role") <= 50),
            "token" TEXT NOT NULL UNIQUE CHECK(length("token") <= 255),
            "status" TEXT NOT NULL DEFAULT 'pending' CHECK(length("status") <= 50),
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE CASCADE
        );

        INSERT INTO "HouseholdInvitation_new" (
            "id",
            "householdId",
            "invitedEmail",
            "invitedById",
            "role",
            "token",
            "status",
            "createdAt"
        )
        SELECT
            "id",
            "householdId",
            "invitedEmail",
            "invitedById",
            'owner',
            "token",
            "status",
            "createdAt"
        FROM "HouseholdInvitation";

        DROP TABLE "HouseholdInvitation";
        ALTER TABLE "HouseholdInvitation_new" RENAME TO "HouseholdInvitation";

        PRAGMA foreign_keys = ON;
    `);
}

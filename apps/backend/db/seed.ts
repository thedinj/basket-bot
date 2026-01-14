import * as bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { initializeDatabase } from "../src/db/init";
import { db } from "../src/lib/db/db";

/**
 * Helper to normalize item names (lowercase, trim whitespace)
 */
function normalizeItemName(name: string): string {
    return name.toLowerCase().trim();
}

async function main() {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
        throw new Error(
            "ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables for seeding"
        );
    }

    // Initialize database schema
    initializeDatabase();

    // Check if admin user already exists
    const existingAdmin = db.prepare("SELECT * FROM User WHERE email = ?").get(adminEmail);

    if (existingAdmin) {
        console.log("Admin user already exists. Skipping user seed.");
    } else {
        // Create admin user
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const adminId = randomUUID();

        db.prepare(
            `
            INSERT INTO User (id, email, name, password, scopes, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `
        ).run(adminId, adminEmail, "Admin", hashedPassword, "admin");

        console.log(`Created admin user: ${adminEmail} (ID: ${adminId})`);

        // Create default household for admin
        const householdId = randomUUID();
        db.prepare(
            `
            INSERT INTO Household (id, name, createdById, updatedById, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `
        ).run(householdId, "Admin's Household", adminId, adminId);

        console.log(`Created household: Admin's Household (ID: ${householdId})`);

        // Add admin as owner of the household
        const householdMemberId = randomUUID();
        db.prepare(
            `
            INSERT INTO HouseholdMember (id, householdId, userId, role, createdAt)
            VALUES (?, ?, ?, ?, datetime('now'))
        `
        ).run(householdMemberId, householdId, adminId, "owner");

        console.log(`Added ${adminEmail} as owner of Admin's Household`);

        // Insert initial store data
        insertInitialStoreData(householdId, adminId);
    }
}

/**
 * Inserts realistic test data into a store for development/testing purposes.
 */
function insertInitialStoreData(householdId: string, adminUserId: string) {
    // Create initial store
    const storeId = randomUUID();
    db.prepare(
        `
        INSERT INTO Store (id, householdId, name, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(storeId, householdId, "Sample Store", adminUserId, adminUserId);

    console.log(`Created store: Sample Store (ID: ${storeId})`);

    // Create aisles
    const deliAisleId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreAisle (id, storeId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(deliAisleId, storeId, "Deli", 0, adminUserId, adminUserId);

    const bakeryAisleId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreAisle (id, storeId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(bakeryAisleId, storeId, "Bakery", 1, adminUserId, adminUserId);

    const produceAisleId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreAisle (id, storeId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(produceAisleId, storeId, "Produce", 2, adminUserId, adminUserId);

    const aisle1Id = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreAisle (id, storeId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(aisle1Id, storeId, "Aisle 1", 3, adminUserId, adminUserId);

    const cannedGoodsSectionId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreSection (id, storeId, aisleId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(cannedGoodsSectionId, storeId, aisle1Id, "Canned Goods", 0, adminUserId, adminUserId);

    const pastaSectionId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreSection (id, storeId, aisleId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(pastaSectionId, storeId, aisle1Id, "Pasta & Grains", 1, adminUserId, adminUserId);

    const aisle2Id = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreAisle (id, storeId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(aisle2Id, storeId, "Aisle 2", 4, adminUserId, adminUserId);

    const dairyAisleId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreAisle (id, storeId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(dairyAisleId, storeId, "Dairy & Eggs", 5, adminUserId, adminUserId);

    const frozenAisleId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreAisle (id, storeId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(frozenAisleId, storeId, "Frozen Foods", 6, adminUserId, adminUserId);

    const liquorAisleId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreAisle (id, storeId, name, sortOrder, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(liquorAisleId, storeId, "Wine, Beer, and Liquor", 7, adminUserId, adminUserId);

    console.log("Created aisles and sections");

    // Create sample items and shopping list entries
    const bananasId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreItem (id, storeId, name, nameNorm, aisleId, sectionId, usageCount, lastUsedAt, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, NULL, ?, datetime('now'), ?, ?, datetime('now'), datetime('now'))
    `
    ).run(
        bananasId,
        storeId,
        "Bananas",
        normalizeItemName("Bananas"),
        produceAisleId,
        1,
        adminUserId,
        adminUserId
    );

    const bananasListItemId = randomUUID();
    db.prepare(
        `
        INSERT INTO ShoppingListItem (id, storeId, storeItemId, qty, unitId, notes, isSample, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(
        bananasListItemId,
        storeId,
        bananasId,
        1,
        "bunch",
        "Ripe, not green",
        1,
        adminUserId,
        adminUserId
    );

    const frenchBreadId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreItem (id, storeId, name, nameNorm, aisleId, sectionId, usageCount, lastUsedAt, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, NULL, ?, datetime('now'), ?, ?, datetime('now'), datetime('now'))
    `
    ).run(
        frenchBreadId,
        storeId,
        "French Bread",
        normalizeItemName("French Bread"),
        bakeryAisleId,
        1,
        adminUserId,
        adminUserId
    );

    const frenchBreadListItemId = randomUUID();
    db.prepare(
        `
        INSERT INTO ShoppingListItem (id, storeId, storeItemId, qty, unitId, notes, isSample, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(frenchBreadListItemId, storeId, frenchBreadId, 1, adminUserId, adminUserId);

    const pennePastaId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreItem (id, storeId, name, nameNorm, aisleId, sectionId, usageCount, lastUsedAt, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, NULL, ?, ?, datetime('now'), ?, ?, datetime('now'), datetime('now'))
    `
    ).run(
        pennePastaId,
        storeId,
        "Penne Pasta",
        normalizeItemName("Penne Pasta"),
        pastaSectionId,
        1,
        adminUserId,
        adminUserId
    );

    const pennePastaListItemId = randomUUID();
    db.prepare(
        `
        INSERT INTO ShoppingListItem (id, storeId, storeItemId, qty, unitId, notes, isSample, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(pennePastaListItemId, storeId, pennePastaId, 1, adminUserId, adminUserId);

    const milkId = randomUUID();
    db.prepare(
        `
        INSERT INTO StoreItem (id, storeId, name, nameNorm, aisleId, sectionId, usageCount, lastUsedAt, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, NULL, ?, datetime('now'), ?, ?, datetime('now'), datetime('now'))
    `
    ).run(
        milkId,
        storeId,
        "Milk",
        normalizeItemName("Milk"),
        dairyAisleId,
        1,
        adminUserId,
        adminUserId
    );

    const milkListItemId = randomUUID();
    db.prepare(
        `
        INSERT INTO ShoppingListItem (id, storeId, storeItemId, qty, unitId, notes, isSample, createdById, updatedById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(milkListItemId, storeId, milkId, 1, "gallon", 1, adminUserId, adminUserId);

    console.log("Created sample store items and shopping list");
}

main()
    .catch((e) => {
        console.error("Error seeding database:", e);
        process.exit(1);
    })
    .finally(() => {
        db.close();
    });

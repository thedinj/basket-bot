import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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

    // Check if admin user already exists
    const existingAdmin = await prisma.user.findUnique({
        where: { email: adminEmail },
    });

    if (existingAdmin) {
        console.log("Admin user already exists. Skipping user seed.");
    } else {
        // Create admin user
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const admin = await prisma.user.create({
            data: {
                email: adminEmail,
                name: "Admin",
                password: hashedPassword,
                scopes: "admin",
            },
        });

        console.log(`Created admin user: ${admin.email} (ID: ${admin.id})`);

        // Create default household for admin
        const household = await prisma.household.create({
            data: {
                name: `${admin.name}'s Household`,
            },
        });

        console.log(`Created household: ${household.name} (ID: ${household.id})`);

        // Add admin as owner of the household
        await prisma.householdMember.create({
            data: {
                householdId: household.id,
                userId: admin.id,
                role: "owner",
            },
        });

        console.log(`Added ${admin.email} as owner of ${household.name}`);

        // Insert initial store data
        await insertInitialStoreData(household.id);
    }
}

/**
 * Inserts realistic test data into a store for development/testing purposes.
 * Creates a store structure with aisles, sections, store items, and a shopping list.
 */
async function insertInitialStoreData(householdId: string) {
    // Create initial store
    const store = await prisma.store.create({
        data: {
            householdId,
            name: "Sample Store",
        },
    });

    console.log(`Created store: ${store.name} (ID: ${store.id})`);

    // Create aisles
    await prisma.storeAisle.create({
        data: {
            storeId: store.id,
            name: "Deli",
            sortOrder: 0,
        },
    });

    const bakeryAisle = await prisma.storeAisle.create({
        data: {
            storeId: store.id,
            name: "Bakery",
            sortOrder: 1,
        },
    });

    const produceAisle = await prisma.storeAisle.create({
        data: {
            storeId: store.id,
            name: "Produce",
            sortOrder: 2,
        },
    });

    const aisle1 = await prisma.storeAisle.create({
        data: {
            storeId: store.id,
            name: "Aisle 1",
            sortOrder: 3,
        },
    });

    await prisma.storeSection.create({
        data: {
            storeId: store.id,
            aisleId: aisle1.id,
            name: "Canned Goods",
            sortOrder: 0,
        },
    });

    const pastaSection = await prisma.storeSection.create({
        data: {
            storeId: store.id,
            aisleId: aisle1.id,
            name: "Pasta & Grains",
            sortOrder: 1,
        },
    });

    await prisma.storeAisle.create({
        data: {
            storeId: store.id,
            name: "Aisle 2",
            sortOrder: 4,
        },
    });

    const dairyAisle = await prisma.storeAisle.create({
        data: {
            storeId: store.id,
            name: "Dairy & Eggs",
            sortOrder: 5,
        },
    });

    await prisma.storeAisle.create({
        data: {
            storeId: store.id,
            name: "Frozen Foods",
            sortOrder: 6,
        },
    });

    await prisma.storeAisle.create({
        data: {
            storeId: store.id,
            name: "Wine, Beer, and Liquor",
            sortOrder: 7,
        },
    });

    console.log("Created aisles and sections");

    // Create sample items and shopping list entries
    const bananas = await prisma.storeItem.create({
        data: {
            storeId: store.id,
            name: "Bananas",
            nameNorm: normalizeItemName("Bananas"),
            aisleId: produceAisle.id,
            sectionId: null,
            usageCount: 1,
            lastUsedAt: new Date(),
        },
    });

    await prisma.shoppingListItem.create({
        data: {
            storeId: store.id,
            storeItemId: bananas.id,
            qty: 1,
            unitId: "bunch",
            notes: "Ripe, not green",
            isSample: true,
        },
    });

    const frenchBread = await prisma.storeItem.create({
        data: {
            storeId: store.id,
            name: "French Bread",
            nameNorm: normalizeItemName("French Bread"),
            aisleId: bakeryAisle.id,
            sectionId: null,
            usageCount: 1,
            lastUsedAt: new Date(),
        },
    });

    await prisma.shoppingListItem.create({
        data: {
            storeId: store.id,
            storeItemId: frenchBread.id,
            qty: null,
            unitId: null,
            notes: null,
            isSample: true,
        },
    });

    const pennePasta = await prisma.storeItem.create({
        data: {
            storeId: store.id,
            name: "Penne Pasta",
            nameNorm: normalizeItemName("Penne Pasta"),
            aisleId: null,
            sectionId: pastaSection.id,
            usageCount: 1,
            lastUsedAt: new Date(),
        },
    });

    await prisma.shoppingListItem.create({
        data: {
            storeId: store.id,
            storeItemId: pennePasta.id,
            qty: null,
            unitId: null,
            notes: null,
            isSample: true,
        },
    });

    const milk = await prisma.storeItem.create({
        data: {
            storeId: store.id,
            name: "Milk",
            nameNorm: normalizeItemName("Milk"),
            aisleId: dairyAisle.id,
            sectionId: null,
            usageCount: 1,
            lastUsedAt: new Date(),
        },
    });

    await prisma.shoppingListItem.create({
        data: {
            storeId: store.id,
            storeItemId: milk.id,
            qty: 1,
            unitId: "gallon",
            notes: null,
            isSample: true,
        },
    });

    console.log("Created sample store items and shopping list");
}

main()
    .catch((e) => {
        console.error("Error seeding database:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

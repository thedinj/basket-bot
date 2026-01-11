import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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
        console.log("Admin user already exists. Skipping seed.");
        return;
    }

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
}

main()
    .catch((e) => {
        console.error("Error seeding database:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

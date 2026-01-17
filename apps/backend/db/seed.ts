import { hashPassword } from "@/lib/auth/password";
import { randomUUID } from "crypto";
import { config } from "dotenv";
import { resolve } from "path";
import { initializeDatabase } from "../src/db/init";
import { db } from "../src/lib/db/db";

// Load environment variables from .env file
config({ path: resolve(__dirname, "../.env") });

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
        // Create admin user (no store/data - this is an administrative account)
        const hashedPassword = await hashPassword(adminPassword);
        const adminId = randomUUID();

        db.prepare(
            `
            INSERT INTO User (id, email, name, password, scopes, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `
        ).run(adminId, adminEmail, "Admin", hashedPassword, "admin");

        console.log(`Created admin user: ${adminEmail} (ID: ${adminId})`);
        console.log("Admin account has no stores or data (administrative purposes only)");
    }
}

main()
    .catch((e) => {
        console.error("Error seeding database:", e);
        process.exit(1);
    })
    .finally(() => {
        db.close();
    });

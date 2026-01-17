import { RemoteDatabase } from "./remote";
import { Database } from "./types";

export type DatabaseType = "remote";

let databaseInstance: Database | null = null;

/**
 * Get the configured database type from environment variables
 */
function getDatabaseType(): DatabaseType {
    return "remote";
}

/**
 * Factory function to get the appropriate database implementation
 * Returns a singleton instance that persists across calls
 */
export async function getDatabase(): Promise<Database> {
    if (databaseInstance) {
        return databaseInstance;
    }

    const dbType = getDatabaseType();

    let db: Database;
    switch (dbType) {
        case "remote":
            db = new RemoteDatabase();
            break;
        default:
            throw new Error(`Unknown database type: ${dbType}`);
    }

    await db.initialize();
    databaseInstance = db;
    return db;
}

/**
 * Reset the database singleton (useful for testing or switching implementations)
 */
export async function resetDatabaseInstance(): Promise<void> {
    if (databaseInstance) {
        await databaseInstance.close();
        databaseInstance = null;
    }
}

// Re-export types for convenience
export { BaseDatabase } from "./base";
export { RemoteDatabase } from "./remote";
export type {
    CoreDatabase,
    Database,
    DatabaseChangeListener,
    DatabaseEvents,
    EntityDatabase,
} from "./types";

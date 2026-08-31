import { RemoteDatabase } from "./remote";
import { Database } from "./types";

let databaseInstance: Database | null = null;
let initializing: Promise<Database> | null = null;

/**
 * Get the app's database, initializing it on first call.
 *
 * There is one implementation (`RemoteDatabase`) and has been since the app went always-online;
 * this used to be a factory over a `DatabaseType` union of one, dispatching through a
 * single-case switch with an unreachable default.
 *
 * Concurrent callers share one in-flight initialization rather than racing to construct and
 * `initialize()` competing instances.
 */
export async function getDatabase(): Promise<Database> {
    if (databaseInstance) {
        return databaseInstance;
    }

    if (!initializing) {
        initializing = (async () => {
            const db = new RemoteDatabase();
            await db.initialize();
            databaseInstance = db;
            return db;
        })().finally(() => {
            initializing = null;
        });
    }

    return initializing;
}

// Re-export types for convenience
export { RemoteDatabase } from "./remote";
export type { CoreDatabase, Database, EntityDatabase } from "./types";

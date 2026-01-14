import { createContext } from "react";
import type { Database } from "./types";

/**
 * Database context value
 */
export interface DatabaseContextValue {
    database: Database;
}

/**
 * Context for database instance
 */
export const DatabaseContext = createContext<DatabaseContextValue | null>(null);

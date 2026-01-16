import { createContext } from "react";
import type { LoginResponse } from "@basket-bot/core";

/**
 * Context value for authentication management
 */
export interface AuthContextValue {
    /** Current authenticated user (or null if not authenticated) */
    user: LoginResponse["user"] | null;
    /** Whether the user is authenticated */
    isAuthenticated: boolean;
    /** Login with email and password */
    login: (email: string, password: string) => Promise<void>;
    /** Register a new user and auto-login */
    register: (email: string, name: string, password: string) => Promise<void>;
    /** Logout and clear tokens */
    logout: () => Promise<void>;
}

/**
 * Context for managing authentication state
 */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

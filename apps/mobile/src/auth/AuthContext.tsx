import { LoginUser } from "@basket-bot/core";
import { createContext } from "react";

/**
 * Context value for authentication management
 */
export interface AuthContextValue {
    /** Current authenticated user (or null if not authenticated) */
    user: LoginUser | null;
    /** Whether the user is authenticated */
    isAuthenticated: boolean;
    /** Whether the auth provider is still loading initial state */
    isInitializing: boolean;
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

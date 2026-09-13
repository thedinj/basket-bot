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
    /** Whether auth is fully ready (tokens validated, user loaded) */
    isAuthReady: boolean;
    /**
     * Whether stored tokens were found on launch. Distinguishes "signed out" from "signed in
     * but the server hasn't confirmed it yet", which is what lets an outage show the
     * unreachable screen instead of a login form the user cannot use.
     */
    hasStoredTokens: boolean;
    /** Whether the backend is currently unreachable (as opposed to rejecting our tokens) */
    isServerUnreachable: boolean;
    /** Login with email and password */
    login: (email: string, password: string) => Promise<void>;
    /** Register a new user and auto-login */
    register: (
        email: string,
        name: string,
        password: string,
        invitationCode?: string
    ) => Promise<void>;
    /** Logout and clear tokens */
    logout: () => Promise<void>;
}

/**
 * Context for managing authentication state
 */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

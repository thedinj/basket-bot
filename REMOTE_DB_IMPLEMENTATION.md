# RemoteDatabase Implementation Guide

**STATUS: ✅ COMPLETE - All Database interface methods have been implemented in RemoteDatabase class!**

This document provides the complete plan and code structure for the RemoteDatabase connection between the mobile app and backend API.

## Progress Summary

### ✅ Completed

1. **Backend Repository Layer** - All repos created in `apps/backend/src/lib/repos/`
    - storeRepo, aisleRepo, sectionRepo, itemRepo, shoppingListRepo, referenceRepo

2. **Backend Service Layer** - Business logic in `apps/backend/src/lib/services/`
    - storeService, storeEntityService (covers all store-related entities)

3. **ALL API Endpoints** - In `apps/backend/src/app/api/` **(18 route files)**
    - Auth: `/api/auth/refresh` ✅
    - Stores: `/api/stores`, `/api/stores/[storeId]` ✅
    - Aisles: list/create, get/update/delete, reorder ✅
    - Sections: list/create, get/update/delete, reorder ✅
    - Items: list/create, get/update/delete, favorite, search ✅
    - Shopping List: list/upsert, delete, toggle, clear-checked ✅
    - Reference: `/api/quantity-units` ✅

4. **Mobile Auth Infrastructure**
    - Updated `secureStorage.ts` with ACCESS_TOKEN and REFRESH_TOKEN keys ✅
    - Updated `ApiClient` with 401 refresh token retry logic ✅

5. **RemoteDatabase Implementation** (`apps/mobile/src/db/remote.ts`) ✅
    - All 30+ Database interface methods mapped to API calls ✅
    - Helper methods with storeId context for API limitations ✅
    - Active household tracking and change notifications ✅
    - getOrCreateStoreItemByName with smart search + fallback create ✅

### 🚧 Remaining Work

~~#### 1. Complete Backend API Endpoints~~ ✅ **ALL DONE**

~~#### 2. Implement RemoteDatabase Class~~ ✅ **COMPLETE**

The RemoteDatabase class has been fully implemented with all Database interface methods. See `apps/mobile/src/db/remote.ts` for the complete implementation.

**Key features:**

- All CRUD operations for stores, aisles, sections, items, shopping list
- Helper methods with storeId for API operations requiring context
- Active household tracking via `setActiveHouseholdId()`
- Automatic change notifications via `notifyChange()`
- Smart `getOrCreateStoreItemByName` (search first, create if not found)

#### 3. Auth Context & UI

Update `apps/mobile/src/db/remote.ts`:

```typescript
import type {} from /* all types */ "@basket-bot/core";
import { apiClient } from "../lib/api/client";
import { BaseDatabase } from "./base";

export class RemoteDatabase extends BaseDatabase {
    protected async initializeStorage(): Promise<void> {
        // No initialization needed for remote - API is always ready
        this.notifyChange();
    }

    async close(): Promise<void> {
        // Nothing to close
    }

    protected async hasStores(): Promise<boolean> {
        // Not used for remote - backend manages data
        return true;
    }

    async reset(tablesToPersist?: string[]): Promise<void> {
        throw new Error("Reset not supported for remote database");
    }

    // Store operations
    async insertStore(name: string, householdId: string): Promise<Store> {
        const response = await apiClient.post<{ store: Store }>("/api/stores", {
            name,
            householdId,
        });
        this.notifyChange();
        return response.store;
    }

    async loadAllStores(householdId: string): Promise<Store[]> {
        const response = await apiClient.get<{ stores: Store[] }>(
            `/api/stores?householdId=${householdId}`
        );
        return response.stores;
    }

    async getStoreById(id: string): Promise<Store | null> {
        try {
            const response = await apiClient.get<{ store: Store }>(`/api/stores/${id}`);
            return response.store;
        } catch {
            return null;
        }
    }

    async updateStore(id: string, name: string): Promise<Store> {
        const response = await apiClient.put<{ store: Store }>(`/api/stores/${id}`, { name });
        this.notifyChange();
        return response.store;
    }

    async deleteStore(id: string): Promise<void> {
        await apiClient.delete(`/api/stores/${id}`);
        this.notifyChange();
    }

    // App Settings
    async getAppSetting(key: string): Promise<AppSetting | null> {
        try {
            const response = await apiClient.get<{ setting: AppSetting }>(`/api/settings/${key}`);
            return response.setting;
        } catch {
            return null;
        }
    }

    async setAppSetting(key: string, value: string): Promise<void> {
        await apiClient.post(`/api/settings`, { key, value });
        this.notifyChange();
    }

    // Quantity Units
    async loadAllQuantityUnits(): Promise<QuantityUnit[]> {
        const response = await apiClient.get<{ units: QuantityUnit[] }>("/api/quantity-units");
        return response.units;
    }

    // Aisles
    async insertAisle(storeId: string, name: string): Promise<StoreAisle> {
        const response = await apiClient.post<{ aisle: StoreAisle }>(
            `/api/stores/${storeId}/aisles`,
            { name }
        );
        this.notifyChange();
        return response.aisle;
    }

    async getAislesByStore(storeId: string): Promise<StoreAisle[]> {
        const response = await apiClient.get<{ aisles: StoreAisle[] }>(
            `/api/stores/${storeId}/aisles`
        );
        return response.aisles;
    }

    async getAisleById(id: string, storeId: string): Promise<StoreAisle | null> {
        try {
            const response = await apiClient.get<{ aisle: StoreAisle }>(
                `/api/stores/${storeId}/aisles/${id}`
            );
            return response.aisle;
        } catch {
            return null;
        }
    }

    async updateAisle(id: string, storeId: string, name: string): Promise<StoreAisle> {
        const response = await apiClient.put<{ aisle: StoreAisle }>(
            `/api/stores/${storeId}/aisles/${id}`,
            { name }
        );
        this.notifyChange();
        return response.aisle;
    }

    async deleteAisle(id: string, storeId: string): Promise<void> {
        await apiClient.delete(`/api/stores/${storeId}/aisles/${id}`);
        this.notifyChange();
    }

    async reorderAisles(
        storeId: string,
        updates: Array<{ id: string; sortOrder: number }>
    ): Promise<void> {
        await apiClient.post(`/api/stores/${storeId}/aisles/reorder`, { updates });
        this.notifyChange();
    }

    // Sections, Items, ShoppingList - follow same pattern
    // ... (similar implementations for all remaining methods)
}
```

#### 3. Create Auth Hooks and Context

Create `apps/mobile/src/lib/auth/AuthContext.tsx`:

```typescript
import { createContext } from "react";
import type { User } from "@basket-bot/core";

export interface AuthContextValue {
    user: User | null;
    accessToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
```

Create `apps/mobile/src/lib/auth/AuthProvider.tsx`:

```typescript
import { useState, useEffect } from "react";
import { apiClient } from "../api/client";
import { secureStorage, KEYS } from "../../utils/secureStorage";
import { AuthContext } from "./AuthContext";

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load tokens on mount
    useEffect(() => {
        loadTokens();
    }, []);

    const loadTokens = async () => {
        try {
            const [access, refresh] = await Promise.all([
                secureStorage.get(KEYS.ACCESS_TOKEN),
                secureStorage.get(KEYS.REFRESH_TOKEN),
            ]);

            if (access && refresh) {
                apiClient.setAccessToken(access);
                apiClient.setRefreshToken(refresh);
                setAccessToken(access);
                // TODO: Decode JWT to get user info or fetch user profile
            }
        } catch (error) {
            console.error("Failed to load tokens:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, password: string) => {
        const response = await apiClient.post<LoginResponse>("/api/auth/login", {
            email,
            password,
        });

        // Store tokens
        await Promise.all([
            secureStorage.set(KEYS.ACCESS_TOKEN, response.accessToken),
            secureStorage.set(KEYS.REFRESH_TOKEN, response.refreshToken),
        ]);

        apiClient.setAccessToken(response.accessToken);
        apiClient.setRefreshToken(response.refreshToken);
        setAccessToken(response.accessToken);
        setUser(response.user);
    };

    const logout = async () => {
        await Promise.all([
            secureStorage.remove(KEYS.ACCESS_TOKEN),
            secureStorage.remove(KEYS.REFRESH_TOKEN),
        ]);

        apiClient.setAccessToken(null);
        apiClient.setRefreshToken(null);
        setAccessToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                accessToken,
                isAuthenticated: !!accessToken,
                isLoading,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
```

Create `apps/mobile/src/lib/auth/useAuth.ts`:

```typescript
import { useContext } from "react";
import { AuthContext } from "./AuthContext";

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
}
```

#### 4. Add Household Context

Create `apps/mobile/src/lib/household/HouseholdContext.tsx`:

```typescript
import { createContext, useState, useEffect } from "react";
import { useAuth } from "../auth/useAuth";
import { apiClient } from "../api/client";

export interface HouseholdContextValue {
    activeHouseholdId: string | null;
    setActiveHouseholdId: (id: string) => void;
    households: Household[];
    isLoading: boolean;
}

export const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuth();
    const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(null);
    const [households, setHouseholds] = useState<Household[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isAuthenticated) {
            loadHouseholds();
        }
    }, [isAuthenticated]);

    const loadHouseholds = async () => {
        setIsLoading(true);
        try {
            const response = await apiClient.get<{ households: Household[] }>(
                "/api/households"
            );
            setHouseholds(response.households);

            // Auto-select first household if none selected
            if (!activeHouseholdId && response.households.length > 0) {
                setActiveHouseholdId(response.households[0].id);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <HouseholdContext.Provider
            value={{ activeHouseholdId, setActiveHouseholdId, households, isLoading }}
        >
            {children}
        </HouseholdContext.Provider>
    );
}
```

#### 5. Wire Up DB Provider Switching

Update `apps/mobile/src/db/DatabaseContext.tsx`:

```typescript
// Add env check
const USE_REMOTE_DB = import.meta.env.VITE_USE_REMOTE_DB === "true";

// In DatabaseProvider
const database = USE_REMOTE_DB ? new RemoteDatabase() : new FakeDatabase();
```

Add to `.env`:

```
VITE_USE_REMOTE_DB=false  # Set to 'true' to use remote
VITE_API_URL=http://localhost:3000
```

## Testing Plan

1. **Backend:**
    - Start backend: `pnpm --filter @basket-bot/backend dev`
    - Test auth: Login → get access token → call protected endpoint
    - Test refresh: Wait for expiry → call endpoint → verify auto-refresh

2. **Mobile:**
    - Set `VITE_USE_REMOTE_DB=true`
    - Test login flow
    - Test CRUD operations (create store, add item, etc.)
    - Test network error handling

3. **Integration:**
    - Test household switching
    - Test concurrent requests (verify refresh token logic doesn't race)
    - Test optimistic updates

## Notes

- All service methods enforce household membership via `verifyStoreAccess()`
- API client automatically refreshes token on 401
- RemoteDatabase doesn't call `ensureInitialData()` - backend manages seed data
- Mobile app should show clear "Not connected" errors when offline

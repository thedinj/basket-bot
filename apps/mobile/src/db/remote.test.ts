import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/secureStorage", () => ({
    KEYS: { ACCESS_TOKEN: "auth_access_token", REFRESH_TOKEN: "auth_refresh_token" },
    secureStorage: {
        get: vi.fn(async () => null),
        set: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
    },
}));

vi.mock("../lib/api/client", async () => {
    const actual = await vi.importActual<typeof import("../lib/api/client")>("../lib/api/client");
    return {
        ...actual,
        apiClient: {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
        },
    };
});

import { apiClient } from "../lib/api/client";
import { RemoteDatabase } from "./remote";

const post = apiClient.post as ReturnType<typeof vi.fn>;
const get = apiClient.get as ReturnType<typeof vi.fn>;

const STORE = "store-1";

beforeEach(() => {
    vi.clearAllMocks();
});

/**
 * Resolving an item by name has to be the server's job, in one call.
 *
 * This used to be faked here — search, then create when the search came back without an exact
 * match — and it failed on items the user had just picked from their own autocomplete. The
 * search returns a ranked list truncated to what was asked for (one row), skips hidden items,
 * and was compared by lowercased display name, while uniqueness is `(storeId, nameNorm)`. Any
 * of those misses became a create for a name that exists and an `ITEM_NAME_CONFLICT` nobody
 * could act on. A test that only asserted the returned item would have passed throughout, so
 * this asserts the shape of the conversation instead.
 */
describe("RemoteDatabase.getOrCreateStoreItemByName", () => {
    it("resolves the item in a single call to the server", async () => {
        const item = { id: "item-1", name: "Chocolate chips" };
        post.mockResolvedValueOnce({ item });

        const database = new RemoteDatabase();
        const result = await database.getOrCreateStoreItemByName(STORE, "Chocolate chips");

        expect(result).toBe(item);
        expect(post).toHaveBeenCalledTimes(1);
        expect(post).toHaveBeenCalledWith(`/api/stores/${STORE}/items/get-or-create`, {
            name: "Chocolate chips",
            aisleId: null,
            sectionId: null,
        });
    });

    it("never searches, and never falls back to creating the item itself", async () => {
        post.mockResolvedValueOnce({ item: { id: "item-1", name: "Chocolate chips" } });

        const database = new RemoteDatabase();
        await database.getOrCreateStoreItemByName(STORE, "Chocolate chips");

        expect(get).not.toHaveBeenCalled();
        expect(post).not.toHaveBeenCalledWith(`/api/stores/${STORE}/items`, expect.anything());
    });

    it("passes a location through when one is given", async () => {
        post.mockResolvedValueOnce({ item: { id: "item-1", name: "Chocolate chips" } });

        const database = new RemoteDatabase();
        await database.getOrCreateStoreItemByName(STORE, "Chocolate chips", null, "section-9");

        expect(post).toHaveBeenCalledWith(`/api/stores/${STORE}/items/get-or-create`, {
            name: "Chocolate chips",
            aisleId: null,
            sectionId: "section-9",
        });
    });
});

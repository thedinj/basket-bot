/**
 * Covers the per-provider key slots and, more importantly, the one-way migration behind
 * them. Installs that predate configurable providers hold their key in a single
 * `openai_api_key` slot; if that fallback stops working those users silently lose AI
 * features with no error and no way to tell why short of re-entering the key. The
 * fallback must also stay read-only, so a saved key never lands back in the legacy slot.
 *
 * Runs against the web (localStorage) branch — the native branch is a thin delegation to
 * the Capacitor plugin and has no logic of its own.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => false },
}));

const LEGACY_SLOT = "secure_openai_api_key";
const OPENAI_SLOT = "secure_llm_api_key_openai";
const ANTHROPIC_SLOT = "secure_llm_api_key_anthropic";

/** Minimal localStorage stand-in; the node test environment provides none. */
const installLocalStorage = () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
        get length() {
            return store.size;
        },
        key: (index: number) => [...store.keys()][index] ?? null,
    });
    return store;
};

let store: Map<string, string>;
let secureStorage: (typeof import("./secureStorage"))["secureStorage"];
let llmApiKeyStorageKey: (typeof import("./secureStorage"))["llmApiKeyStorageKey"];

beforeEach(async () => {
    store = installLocalStorage();
    vi.resetModules();
    ({ secureStorage, llmApiKeyStorageKey } = await import("./secureStorage"));
});

describe("llmApiKeyStorageKey", () => {
    it("namespaces each provider into its own slot", () => {
        expect(llmApiKeyStorageKey("openai")).toBe("llm_api_key_openai");
        expect(llmApiKeyStorageKey("anthropic")).toBe("llm_api_key_anthropic");
    });
});

describe("getLLMApiKey", () => {
    it("returns null when the provider has no key", async () => {
        expect(await secureStorage.getLLMApiKey("anthropic")).toBeNull();
    });

    it("reads the provider's own slot", async () => {
        store.set(ANTHROPIC_SLOT, "sk-ant-stored");
        expect(await secureStorage.getLLMApiKey("anthropic")).toBe("sk-ant-stored");
    });

    it("falls back to the pre-provider slot so existing installs keep working", async () => {
        store.set(LEGACY_SLOT, "sk-from-old-version");
        expect(await secureStorage.getLLMApiKey("openai")).toBe("sk-from-old-version");
    });

    it("prefers the provider slot once the user has saved a new key", async () => {
        store.set(LEGACY_SLOT, "sk-from-old-version");
        store.set(OPENAI_SLOT, "sk-current");
        expect(await secureStorage.getLLMApiKey("openai")).toBe("sk-current");
    });

    it("does not lend the legacy OpenAI key to a different provider", async () => {
        store.set(LEGACY_SLOT, "sk-from-old-version");
        expect(await secureStorage.getLLMApiKey("anthropic")).toBeNull();
    });
});

describe("setLLMApiKey", () => {
    it("writes to the provider slot and never back to the legacy one", async () => {
        await secureStorage.setLLMApiKey("openai", "sk-new");

        expect(store.get(OPENAI_SLOT)).toBe("sk-new");
        expect(store.has(LEGACY_SLOT)).toBe(false);
    });

    it("trims a pasted key", async () => {
        await secureStorage.setLLMApiKey("anthropic", "  sk-ant-padded \n");
        expect(await secureStorage.getLLMApiKey("anthropic")).toBe("sk-ant-padded");
    });

    it("keeps each provider's key independent when switching between them", async () => {
        await secureStorage.setLLMApiKey("openai", "sk-openai");
        await secureStorage.setLLMApiKey("anthropic", "sk-ant");

        expect(await secureStorage.getLLMApiKey("openai")).toBe("sk-openai");
        expect(await secureStorage.getLLMApiKey("anthropic")).toBe("sk-ant");
    });
});

describe("removeLLMApiKey", () => {
    it("forgets one provider's key without touching another's", async () => {
        await secureStorage.setLLMApiKey("openai", "sk-openai");
        await secureStorage.setLLMApiKey("anthropic", "sk-ant");

        await secureStorage.removeLLMApiKey("anthropic");

        expect(await secureStorage.getLLMApiKey("anthropic")).toBeNull();
        expect(await secureStorage.getLLMApiKey("openai")).toBe("sk-openai");
    });

    it("re-exposes the legacy key when the provider slot is cleared", async () => {
        // The fallback is a read path, so clearing the new slot uncovers the old value
        // again rather than leaving the user with nothing.
        store.set(LEGACY_SLOT, "sk-from-old-version");
        await secureStorage.setLLMApiKey("openai", "sk-current");

        await secureStorage.removeLLMApiKey("openai");

        expect(await secureStorage.getLLMApiKey("openai")).toBe("sk-from-old-version");
    });
});

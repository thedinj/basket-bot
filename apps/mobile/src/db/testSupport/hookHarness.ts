import type { QueryClient, QueryClientConfig } from "@tanstack/react-query";
import { vi } from "vitest";

/**
 * A tiny stand-in for React's rendering of a mutation hook.
 *
 * The mutation hooks are ordinary functions that call `useQueryClient()`, `useDatabase()` and
 * `useMutation()`. Everything worth asserting about a cascade — which keys reach
 * `invalidateQueries` — lives in the options object handed to `useMutation`. So instead of
 * rendering, a test replaces those three bindings (see `cacheCascade.test.ts`) and calls the
 * hook directly. That keeps the suite in the existing node environment: no jsdom, no
 * `@testing-library/react`, no Ionic custom elements.
 *
 * The `QueryClient` is deliberately *real*. `setQueryData` / `getQueryData` / `cancelQueries`
 * therefore behave exactly as in the app, which is what makes the optimistic-update and
 * rollback assertions meaningful rather than a restatement of a mock.
 *
 * That real constructor is *injected* via `configureHarness` rather than imported here. A static
 * `import { QueryClient } from "@tanstack/react-query"` would deadlock: the test's `vi.mock`
 * factory for that module awaits this one, so this module importing it back would leave the
 * factory waiting on itself and the suite would hang before collecting a single test.
 */

/**
 * Which mutation lifecycle callback was running when a cache call was made.
 *
 * Partitioning by phase is not optional. `useOptimisticMutation` invalidates *twice*: once in
 * `onMutate` with `refetchType: "none"` purely to nudge subscribers into re-rendering, and again
 * in `onSettled` with the real cascade. Lumping the two together makes every cascade assertion
 * meaningless.
 */
export type Phase = "idle" | "mutate" | "mutationFn" | "success" | "error" | "settled";

export interface CacheCall {
    phase: Phase;
    method: "invalidateQueries" | "removeQueries" | "setQueryData";
    queryKey: unknown[];
    refetchType?: string;
}

interface MutationOptionsLike {
    mutationFn: (variables: unknown) => Promise<unknown>;
    onMutate?: (variables: unknown) => Promise<unknown> | unknown;
    onSuccess?: (data: unknown, variables: unknown, context: unknown) => unknown;
    onError?: (error: unknown, variables: unknown, context: unknown) => unknown;
    onSettled?: (data: unknown, error: unknown, variables: unknown, context: unknown) => unknown;
    meta?: Record<string, unknown>;
}

/** Default resolution for any un-stubbed database method. */
const DEFAULT_RESULT = { id: "stub-id" };

type QueryClientCtor = new (config?: QueryClientConfig) => QueryClient;

let QueryClientImpl: QueryClientCtor | undefined;

/**
 * Hand the harness the real `QueryClient` constructor. Call this once from a test file, after
 * its `vi.mock` calls, passing the `QueryClient` re-exported by the mocked module (the mock
 * spreads `...actual`, so it is the genuine class).
 */
export const configureHarness = (ctor: QueryClientCtor): void => {
    QueryClientImpl = ctor;
    harness.reset();
};

class HookHarness {
    client!: QueryClient;
    calls: CacheCall[] = [];
    phase: Phase = "idle";

    private databaseMethods = new Map<string, ReturnType<typeof vi.fn>>();

    /**
     * Stands in for the `Database` from `useDatabase()`. Any method accessed returns a
     * `vi.fn()` resolving to `DEFAULT_RESULT`, so hook files never need a hand-written double
     * that has to be updated every time the interface grows.
     */
    database = new Proxy(
        {},
        {
            get: (_target, prop: string) => {
                if (!this.databaseMethods.has(prop)) {
                    this.databaseMethods.set(prop, vi.fn().mockResolvedValue(DEFAULT_RESULT));
                }
                return this.databaseMethods.get(prop);
            },
        }
    ) as never;

    reset(): void {
        this.calls = [];
        this.phase = "idle";
        this.databaseMethods.clear();
        if (!QueryClientImpl) {
            throw new Error("hookHarness: call configureHarness(QueryClient) before reset()");
        }
        this.client = new QueryClientImpl({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        });
        this.instrument();
    }

    /** Make a database method resolve to something specific for one test. */
    stub(method: string, value: unknown): void {
        this.databaseMethods.set(method, vi.fn().mockResolvedValue(value));
    }

    /** Records cache traffic without changing what the real QueryClient does. */
    private instrument(): void {
        const client = this.client;
        const record = (
            method: CacheCall["method"],
            queryKey: unknown[] | undefined,
            refetchType?: string
        ) => {
            this.calls.push({ phase: this.phase, method, queryKey: queryKey ?? [], refetchType });
        };

        const realInvalidate = client.invalidateQueries.bind(client);
        client.invalidateQueries = ((filters?: { queryKey?: unknown[]; refetchType?: string }) => {
            record("invalidateQueries", filters?.queryKey, filters?.refetchType);
            return realInvalidate(filters as never);
        }) as typeof client.invalidateQueries;

        const realRemove = client.removeQueries.bind(client);
        client.removeQueries = ((filters?: { queryKey?: unknown[] }) => {
            record("removeQueries", filters?.queryKey);
            return realRemove(filters as never);
        }) as typeof client.removeQueries;

        const realSetQueryData = client.setQueryData.bind(client);
        client.setQueryData = ((queryKey: unknown[], updater: unknown) => {
            record("setQueryData", queryKey);
            return realSetQueryData(queryKey as never, updater as never);
        }) as typeof client.setQueryData;
    }

    /**
     * Stands in for `useMutation`: returns a mutation object whose `mutateAsync` drives the real
     * lifecycle in the real order, tagging every cache call with the phase that made it.
     */
    register(options: MutationOptionsLike) {
        const run = async (variables: unknown): Promise<unknown> => {
            let context: unknown;
            try {
                this.phase = "mutate";
                context = await options.onMutate?.(variables);

                this.phase = "mutationFn";
                const data = await options.mutationFn(variables);

                this.phase = "success";
                await options.onSuccess?.(data, variables, context);

                this.phase = "settled";
                await options.onSettled?.(data, null, variables, context);
                return data;
            } catch (error) {
                this.phase = "error";
                await options.onError?.(error, variables, context);

                this.phase = "settled";
                await options.onSettled?.(undefined, error, variables, context);
                throw error;
            } finally {
                this.phase = "idle";
            }
        };

        return {
            mutateAsync: run,
            mutate: (variables: unknown) => {
                void run(variables).catch(() => undefined);
            },
            isPending: false,
            isError: false,
            isSuccess: false,
            error: null,
            data: undefined,
            reset: () => undefined,
            meta: options.meta,
        };
    }

    /** Keys invalidated during a given phase, as comparable sorted JSON. */
    invalidatedIn(phase: Phase): string[] {
        return this.calls
            .filter((c) => c.method === "invalidateQueries" && c.phase === phase)
            .map((c) => JSON.stringify(c.queryKey))
            .sort();
    }
}

export const harness = new HookHarness();

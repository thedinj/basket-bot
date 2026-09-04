import { useCallback, useState } from "react";

/**
 * Holds the user's in-progress routing decisions for a set of recipe ingredients.
 * The derivation these feed is in `utils/ingredientRouting.ts`; this hook is state only.
 */

export function useRouteIngredients() {
    const [routeMap, setRouteMap] = useState<Map<string, string | null>>(new Map());
    const [defaultStoreId, setDefaultStoreId] = useState<string | null>(null);
    const [unsureSet, setUnsureSet] = useState<Set<string>>(new Set());

    const init = useCallback(
        (
            initialMap: Map<string, string | null>,
            defStore: string | null,
            initialUnsure: Set<string> = new Set()
        ) => {
            setRouteMap(initialMap);
            setDefaultStoreId(defStore);
            setUnsureSet(initialUnsure);
        },
        []
    );

    const toggleUnsure = useCallback((ingredientId: string) => {
        setUnsureSet((prev) => {
            const next = new Set(prev);
            if (next.has(ingredientId)) {
                next.delete(ingredientId);
            } else {
                next.add(ingredientId);
            }
            return next;
        });
    }, []);

    return {
        routeMap,
        setRouteMap,
        defaultStoreId,
        setDefaultStoreId,
        unsureSet,
        toggleUnsure,
        init,
    };
}

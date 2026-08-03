import { useCallback, useState } from "react"

export const DEFAULT_STORE = "__default__"

export interface RawIngredient {
    id: string
    recipeId: string
    name: string
    recipeName: string
    qty: number | null
    unitId: string | null
    excluded: boolean
}

export interface ResolvedIngredient {
    ingredientId: string
    recipeId: string
    name: string
    recipeName: string
    storeId: string | null
    qty: number | null
    scaledQty: number | null
    unitId: string | null
    isUnsure: boolean
    excluded: boolean
}

export function useRouteIngredients() {
    const [routeMap, setRouteMap] = useState<Map<string, string | null>>(new Map())
    const [defaultStoreId, setDefaultStoreId] = useState<string | null>(null)
    const [unsureSet, setUnsureSet] = useState<Set<string>>(new Set())

    const init = useCallback(
        (
            initialMap: Map<string, string | null>,
            defStore: string | null,
            initialUnsure: Set<string> = new Set()
        ) => {
            setRouteMap(initialMap)
            setDefaultStoreId(defStore)
            setUnsureSet(initialUnsure)
        },
        []
    )

    const toggleUnsure = useCallback((ingredientId: string) => {
        setUnsureSet((prev) => {
            const next = new Set(prev)
            if (next.has(ingredientId)) {
                next.delete(ingredientId)
            } else {
                next.add(ingredientId)
            }
            return next
        })
    }, [])

    return {
        routeMap,
        setRouteMap,
        defaultStoreId,
        setDefaultStoreId,
        unsureSet,
        toggleUnsure,
        init,
    }
}

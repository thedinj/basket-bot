import { useCallback, useState } from "react"

export const DEFAULT_STORE = "__default__"

export interface RawIngredient {
    id: string
    recipeId: string
    name: string
    recipeName: string
    qty: number | null
    unitId: string | null
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
}

export function useRouteIngredients() {
    const [routeMap, setRouteMap] = useState<Map<string, string | null>>(new Map())
    const [defaultStoreId, setDefaultStoreId] = useState<string | null>(null)

    const init = useCallback((initialMap: Map<string, string | null>, defStore: string | null) => {
        setRouteMap(initialMap)
        setDefaultStoreId(defStore)
    }, [])

    return { routeMap, setRouteMap, defaultStoreId, setDefaultStoreId, init }
}

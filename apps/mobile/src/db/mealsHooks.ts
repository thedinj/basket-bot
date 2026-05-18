import type {
    Plan,
    PlanHistoryItem,
    PlanWithDetails,
    RecipeIngredient,
    RecipeWithDetails,
} from "@basket-bot/core"
import {
    useInfiniteQuery as useTanstackInfiniteQuery,
    useQueryClient,
    useMutation as useTanstackMutation,
    useQuery as useTanstackQuery,
    useSuspenseQuery as useTanstackSuspenseQuery,
} from "@tanstack/react-query"
import { useToast } from "../hooks/useToast"
import { planApi, recipeApi } from "../lib/api/meals"

// ============================================================================
// Recipe Query Hooks
// ============================================================================

export function useRecipes(householdId: string | null) {
    return useTanstackSuspenseQuery({
        queryKey: ["recipes", householdId],
        queryFn: () => {
            if (!householdId) return [] as RecipeWithDetails[]
            return recipeApi.getRecipes(householdId)
        },
        staleTime: 2 * 60 * 1000,
    })
}

export function useRecipe(householdId: string | null, recipeId: string | null) {
    return useTanstackQuery({
        queryKey: ["recipes", householdId, recipeId],
        queryFn: () => recipeApi.getRecipe(householdId!, recipeId!),
        enabled: !!householdId && !!recipeId,
    })
}

export function useTags(householdId: string | null) {
    return useTanstackQuery({
        queryKey: ["tags", householdId],
        queryFn: () => recipeApi.getTags(householdId!),
        enabled: !!householdId,
        staleTime: 5 * 60 * 1000,
    })
}

export function usePlans(householdId: string | null) {
    return useTanstackQuery({
        queryKey: ["plans", householdId],
        queryFn: () => planApi.getPlans(householdId!),
        enabled: !!householdId,
        staleTime: 60 * 1000,
    })
}

export function usePlan(householdId: string | null, planId: string | null) {
    return useTanstackQuery({
        queryKey: ["plans", householdId, planId],
        queryFn: () => planApi.getPlan(householdId!, planId!),
        enabled: !!householdId && !!planId,
        staleTime: 30 * 1000,
    })
}

export function usePoolCount(
    householdId: string | null,
    tagIds: string[],
    maxCookingTimeMinutes: number | null = null
) {
    return useTanstackQuery({
        queryKey: ["pool-count", householdId, tagIds, maxCookingTimeMinutes],
        queryFn: () => recipeApi.getPoolCount(householdId!, tagIds, maxCookingTimeMinutes),
        enabled: !!householdId,
        staleTime: 30 * 1000,
    })
}

const HISTORY_PAGE_SIZE = 10

export function usePlansHistory(householdId: string | null) {
    return useTanstackInfiniteQuery({
        queryKey: ["plans-history", householdId],
        queryFn: ({ pageParam }: { pageParam: number }) =>
            planApi.getPlansHistory(householdId!, pageParam, HISTORY_PAGE_SIZE),
        enabled: !!householdId,
        initialPageParam: 0,
        getNextPageParam: (
            lastPage: { plans: PlanHistoryItem[]; total: number },
            allPages: { plans: PlanHistoryItem[]; total: number }[]
        ) => {
            const loaded = allPages.reduce((sum, p) => sum + p.plans.length, 0)
            return loaded < lastPage.total ? loaded : undefined
        },
        staleTime: 60 * 1000,
    })
}

// ============================================================================
// Recipe Mutation Hooks
// ============================================================================

export function useCreateRecipe(householdId: string | null) {
    const queryClient = useQueryClient()
    const { showError } = useToast()

    return useTanstackMutation({
        mutationFn: (data: {
            name: string
            source?: string | null
            description?: string | null
            steps?: string | null
            sourceUrl?: string | null
            cookingTimeMinutes?: number | null
        }) => recipeApi.createRecipe(householdId!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["recipes", householdId] })
        },
        onError: (error: Error) => {
            showError(`Failed to create recipe: ${error.message}`)
        },
    })
}

export function useUpdateRecipe(householdId: string | null) {
    const queryClient = useQueryClient()
    const { showError } = useToast()

    return useTanstackMutation({
        mutationFn: (params: {
            recipeId: string
            data: {
                name?: string
                description?: string | null
                steps?: string | null
                sourceUrl?: string | null
                cookingTimeMinutes?: number | null
            }
        }) => recipeApi.updateRecipe(householdId!, params.recipeId, params.data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["recipes", householdId] })
            queryClient.invalidateQueries({ queryKey: ["recipes", householdId, variables.recipeId] })
        },
        onError: (error: Error) => {
            showError(`Failed to update recipe: ${error.message}`)
        },
    })
}

export function useDeleteRecipe(householdId: string | null) {
    const queryClient = useQueryClient()
    const { showError } = useToast()

    return useTanstackMutation({
        mutationFn: (recipeId: string) => recipeApi.deleteRecipe(householdId!, recipeId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["recipes", householdId] })
        },
        onError: (error: Error) => {
            showError(`Failed to delete recipe: ${error.message}`)
        },
    })
}

export function useAddRecipeToShoppingList(householdId: string | null, recipeId: string | undefined) {
    const queryClient = useQueryClient()
    const { showError } = useToast()

    return useTanstackMutation({
        mutationFn: ({
            routes,
            factor = 1,
        }: {
            routes: Array<{ ingredientId: string; storeId: string | null }>
            factor?: number
        }) => {
            const included = routes.filter(
                (r): r is { ingredientId: string; storeId: string } => r.storeId !== null
            )
            return recipeApi.addToShoppingList(householdId!, recipeId!, { routes: included, factor })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["shoppingList"] })
        },
        onError: (error: Error) => {
            showError(`Failed to add to shopping list: ${error.message}`)
        },
    })
}

// ============================================================================
// Tag Mutation Hooks
// ============================================================================

export function useAssignTag(householdId: string | null) {
    const queryClient = useQueryClient()
    const { showError } = useToast()

    return useTanstackMutation({
        mutationFn: (params: { recipeId: string; tagId: string }) =>
            recipeApi.assignTag(householdId!, params.recipeId, params.tagId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["recipes", householdId] })
            queryClient.invalidateQueries({
                queryKey: ["recipes", householdId, variables.recipeId],
            })
        },
        onError: (error: Error) => {
            showError(`Failed to assign tag: ${error.message}`)
        },
    })
}

export function useRemoveTag(householdId: string | null) {
    const queryClient = useQueryClient()
    const { showError } = useToast()

    return useTanstackMutation({
        mutationFn: (params: { recipeId: string; tagId: string }) =>
            recipeApi.removeTag(householdId!, params.recipeId, params.tagId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["recipes", householdId] })
            queryClient.invalidateQueries({
                queryKey: ["recipes", householdId, variables.recipeId],
            })
        },
        onError: (error: Error) => {
            showError(`Failed to remove tag: ${error.message}`)
        },
    })
}

export function useCreateTag(householdId: string | null) {
    const queryClient = useQueryClient()
    const { showError } = useToast()

    return useTanstackMutation({
        mutationFn: (data: { name: string; colorKey?: string | null }) =>
            recipeApi.createTag(householdId!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tags", householdId] })
        },
        onError: (error: Error) => {
            showError(`Failed to create tag: ${error.message}`)
        },
    })
}

export function useUpdateTag(householdId: string | null) {
    const queryClient = useQueryClient()
    const { showError } = useToast()

    return useTanstackMutation({
        mutationFn: (params: {
            tagId: string
            data: { name?: string; colorKey?: string | null }
        }) => recipeApi.updateTag(householdId!, params.tagId, params.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tags", householdId] })
            queryClient.invalidateQueries({ queryKey: ["recipes", householdId] })
        },
        onError: (error: Error) => {
            showError(`Failed to update tag: ${error.message}`)
        },
    })
}

export function useDeleteTag(householdId: string | null) {
    const queryClient = useQueryClient()
    const { showError } = useToast()

    return useTanstackMutation({
        mutationFn: (tagId: string) => recipeApi.deleteTag(householdId!, tagId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tags", householdId] })
            queryClient.invalidateQueries({ queryKey: ["recipes", householdId] })
        },
        onError: (error: Error) => {
            showError(`Failed to delete tag: ${error.message}`)
        },
    })
}

// ============================================================================
// Ingredient Mutation Hooks
// ============================================================================

export function useAddIngredient(householdId: string | null) {
    const queryClient = useQueryClient()
    const { showError } = useToast()

    return useTanstackMutation({
        mutationFn: (params: {
            recipeId: string
            name: string
            shoppingName?: string | null
            qty?: number | null
            shoppingQty?: number | null
            unitId?: string | null
            shoppingUnitId?: string | null
            sortOrder?: number
            notes?: string | null
            excluded?: boolean
        }) => {
            const { recipeId, ...fields } = params
            return recipeApi.addIngredient(householdId!, recipeId, fields)
        },
        onSuccess: (result: RecipeIngredient) => {
            queryClient.invalidateQueries({
                queryKey: ["recipes", householdId, result.recipeId],
            })
        },
        onError: (error: Error) => {
            showError(`Failed to add ingredient: ${error.message}`)
        },
    })
}

export function useUpdateIngredient(householdId: string | null) {
    const queryClient = useQueryClient()
    const { showError } = useToast()

    return useTanstackMutation({
        mutationFn: (params: {
            recipeId: string
            ingredientId: string
            name?: string
            shoppingName?: string | null
            qty?: number | null
            shoppingQty?: number | null
            unitId?: string | null
            shoppingUnitId?: string | null
            sortOrder?: number
            notes?: string | null
            excluded?: boolean
        }) => {
            const { recipeId, ingredientId, ...fields } = params
            return recipeApi.updateIngredient(householdId!, recipeId, ingredientId, fields)
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["recipes", householdId, variables.recipeId],
            })
        },
        onError: (error: Error) => {
            showError(`Failed to update ingredient: ${error.message}`)
        },
    })
}

export function useDeleteIngredient(householdId: string | null) {
    const queryClient = useQueryClient()
    const { showError } = useToast()

    return useTanstackMutation({
        mutationFn: (params: { recipeId: string; ingredientId: string }) =>
            recipeApi.deleteIngredient(householdId!, params.recipeId, params.ingredientId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["recipes", householdId, variables.recipeId],
            })
        },
        onError: (error: Error) => {
            showError(`Failed to delete ingredient: ${error.message}`)
        },
    })
}

// ============================================================================
// Plan Mutation Hooks
// ============================================================================

export function useCreatePlan(householdId: string | null) {
    const queryClient = useQueryClient()
    const { showError } = useToast()

    return useTanstackMutation({
        mutationFn: (data?: { slotCount?: number }) => planApi.createPlan(householdId!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["plans", householdId] })
        },
        onError: (error: Error) => {
            showError(`Failed to create plan: ${error.message}`)
        },
    })
}

export function useUpdatePlan(householdId: string | null) {
    const queryClient = useQueryClient()
    const { showError } = useToast()

    return useTanstackMutation({
        mutationFn: (params: {
            planId: string
            slotCount?: number
            defaultStoreId?: string | null
        }) => {
            const { planId, ...updates } = params
            return planApi.updatePlan(householdId!, planId, updates)
        },
        onSuccess: (result: PlanWithDetails) => {
            queryClient.invalidateQueries({ queryKey: ["plans", householdId, result.id] })
            queryClient.invalidateQueries({ queryKey: ["plans", householdId] })
        },
        onError: (error: Error) => {
            showError(`Failed to update plan: ${error.message}`)
        },
    })
}

export function useDeletePlan(householdId: string | null) {
    const queryClient = useQueryClient()
    const { showError } = useToast()

    return useTanstackMutation({
        mutationFn: (planId: string) => planApi.deletePlan(householdId!, planId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["plans", householdId] })
        },
        onError: (error: Error) => {
            showError(`Failed to delete plan: ${error.message}`)
        },
    })
}

export function useUpdatePlanSlots(householdId: string | null) {
    const queryClient = useQueryClient()
    const { showError } = useToast()

    return useTanstackMutation({
        mutationFn: (params: {
            planId: string
            slots: Array<{
                slotNumber: number
                tagIds: string[]
                maxCookingTimeMinutes?: number | null
                pickedRecipeId?: string | null
                pinned?: boolean
            }>
        }) => planApi.updateSlots(householdId!, params.planId, params.slots),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["plans", householdId, variables.planId] })
        },
        onError: (error: Error) => {
            showError(`Failed to update plan slots: ${error.message}`)
        },
    })
}

export function useUpdatePlanRoutes(householdId: string | null) {
    const queryClient = useQueryClient()
    const { showError } = useToast()

    return useTanstackMutation({
        mutationFn: (params: {
            planId: string
            routes: Array<{
                ingredientId: string
                storeId?: string | null
                overridden?: boolean
                checked?: boolean
            }>
        }) => planApi.updateRoutes(householdId!, params.planId, params.routes),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["plans", householdId, variables.planId] })
        },
        onError: (error: Error) => {
            showError(`Failed to update plan routes: ${error.message}`)
        },
    })
}

export function useRerollSlots(householdId: string | null) {
    const queryClient = useQueryClient()
    const { showError } = useToast()

    return useTanstackMutation({
        mutationFn: (params: { planId: string; slots: number[] }) =>
            planApi.rerollSlots(householdId!, params.planId, params.slots),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["plans", householdId, variables.planId] })
        },
        onError: (error: Error) => {
            showError(`Failed to reroll slots: ${error.message}`)
        },
    })
}

export function useDispatchPlan(householdId: string | null) {
    const queryClient = useQueryClient()
    const { showError, showSuccess } = useToast()

    return useTanstackMutation({
        mutationFn: (params: { planId: string; scaleFactors?: Record<string, number> }) =>
            planApi.dispatchPlan(householdId!, params.planId, params.scaleFactors ?? {}),
        onSuccess: (result: { plan: Plan; itemsAdded: number; itemsSkipped: number }, variables) => {
            queryClient.invalidateQueries({ queryKey: ["plans", householdId] })
            queryClient.invalidateQueries({ queryKey: ["plans", householdId, variables.planId] })
            showSuccess(`Plan dispatched. ${result.itemsAdded} items on the list.`)
        },
        onError: (error: Error) => {
            showError(`Failed to dispatch plan: ${error.message}`)
        },
    })
}

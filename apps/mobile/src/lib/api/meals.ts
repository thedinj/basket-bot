import type {
    AddRecipeToShoppingListRequest,
    AddRecipeToShoppingListResponse,
    Plan,
    PlanHistoryResponse,
    PlanWithDetails,
    Recipe,
    RecipeIngredient,
    RecipeTag,
    RecipeWithDetails,
} from "@basket-bot/core"
import { apiClient } from "./client"

export const recipeApi = {
    async getRecipes(householdId: string): Promise<RecipeWithDetails[]> {
        const response = await apiClient.get<{ recipes: RecipeWithDetails[] }>(
            `/api/households/${householdId}/recipes`
        )
        return response.recipes
    },

    async getRecipe(householdId: string, recipeId: string): Promise<RecipeWithDetails> {
        const response = await apiClient.get<{ recipe: RecipeWithDetails }>(
            `/api/households/${householdId}/recipes/${recipeId}`
        )
        return response.recipe
    },

    async createRecipe(
        householdId: string,
        data: { name: string; description?: string | null; steps?: string | null; sourceUrl?: string | null; cookingTimeMinutes?: number | null }
    ): Promise<Recipe> {
        const response = await apiClient.post<{ recipe: Recipe }>(
            `/api/households/${householdId}/recipes`,
            data
        )
        return response.recipe
    },

    async updateRecipe(
        householdId: string,
        recipeId: string,
        data: { name?: string; description?: string | null; steps?: string | null; sourceUrl?: string | null; cookingTimeMinutes?: number | null }
    ): Promise<Recipe> {
        const response = await apiClient.patch<{ recipe: Recipe }>(
            `/api/households/${householdId}/recipes/${recipeId}`,
            data
        )
        return response.recipe
    },

    async deleteRecipe(householdId: string, recipeId: string): Promise<void> {
        await apiClient.delete(`/api/households/${householdId}/recipes/${recipeId}`)
    },

    async addToShoppingList(
        householdId: string,
        recipeId: string,
        data: AddRecipeToShoppingListRequest
    ): Promise<AddRecipeToShoppingListResponse> {
        return apiClient.post(
            `/api/households/${householdId}/recipes/${recipeId}/add-to-list`,
            data
        )
    },

    async getPoolCount(
        householdId: string,
        tagIds: string[],
        maxCookingTimeMinutes?: number | null
    ): Promise<number> {
        const parts = tagIds.map((id) => `tagIds[]=${encodeURIComponent(id)}`)
        if (maxCookingTimeMinutes != null) {
            parts.push(`maxCookingTimeMinutes=${maxCookingTimeMinutes}`)
        }
        const qs = parts.length ? `?${parts.join("&")}` : ""
        const response = await apiClient.get<{ count: number }>(
            `/api/households/${householdId}/recipes/pool-count${qs}`
        )
        return response.count
    },

    async getTags(householdId: string): Promise<RecipeTag[]> {
        const response = await apiClient.get<{ tags: RecipeTag[] }>(
            `/api/households/${householdId}/tags`
        )
        return response.tags
    },

    async createTag(
        householdId: string,
        data: { name: string; colorKey?: string | null }
    ): Promise<RecipeTag> {
        const response = await apiClient.post<{ tag: RecipeTag }>(
            `/api/households/${householdId}/tags`,
            data
        )
        return response.tag
    },

    async updateTag(
        householdId: string,
        tagId: string,
        data: { name?: string; colorKey?: string | null }
    ): Promise<RecipeTag> {
        const response = await apiClient.patch<{ tag: RecipeTag }>(
            `/api/households/${householdId}/tags/${tagId}`,
            data
        )
        return response.tag
    },

    async deleteTag(householdId: string, tagId: string): Promise<void> {
        await apiClient.delete(`/api/households/${householdId}/tags/${tagId}`)
    },

    async assignTag(householdId: string, recipeId: string, tagId: string): Promise<RecipeWithDetails> {
        const response = await apiClient.post<{ recipe: RecipeWithDetails }>(
            `/api/households/${householdId}/recipes/${recipeId}/tags`,
            { tagId }
        )
        return response.recipe
    },

    async removeTag(householdId: string, recipeId: string, tagId: string): Promise<void> {
        await apiClient.delete(
            `/api/households/${householdId}/recipes/${recipeId}/tags/${tagId}`
        )
    },

    async addIngredient(
        householdId: string,
        recipeId: string,
        data: { name: string; qty?: number | null; unitId?: string | null; sortOrder?: number; notes?: string | null }
    ): Promise<RecipeIngredient> {
        const response = await apiClient.post<{ ingredient: RecipeIngredient }>(
            `/api/households/${householdId}/recipes/${recipeId}/ingredients`,
            data
        )
        return response.ingredient
    },

    async updateIngredient(
        householdId: string,
        recipeId: string,
        ingredientId: string,
        data: { name?: string; qty?: number | null; unitId?: string | null; sortOrder?: number; notes?: string | null }
    ): Promise<RecipeIngredient> {
        const response = await apiClient.patch<{ ingredient: RecipeIngredient }>(
            `/api/households/${householdId}/recipes/${recipeId}/ingredients/${ingredientId}`,
            data
        )
        return response.ingredient
    },

    async deleteIngredient(householdId: string, recipeId: string, ingredientId: string): Promise<void> {
        await apiClient.delete(
            `/api/households/${householdId}/recipes/${recipeId}/ingredients/${ingredientId}`
        )
    },
}

export const planApi = {
    async getPlans(householdId: string): Promise<Plan[]> {
        const response = await apiClient.get<{ plans: Plan[] }>(
            `/api/households/${householdId}/plans`
        )
        return response.plans
    },

    async getPlan(householdId: string, planId: string): Promise<PlanWithDetails> {
        const response = await apiClient.get<{ plan: PlanWithDetails }>(
            `/api/households/${householdId}/plans/${planId}`
        )
        return response.plan
    },

    async createPlan(householdId: string, data?: { slotCount?: number }): Promise<PlanWithDetails> {
        const response = await apiClient.post<{ plan: PlanWithDetails }>(
            `/api/households/${householdId}/plans`,
            data ?? {}
        )
        return response.plan
    },

    async updatePlan(
        householdId: string,
        planId: string,
        data: { slotCount?: number; defaultStoreId?: string | null }
    ): Promise<PlanWithDetails> {
        const response = await apiClient.patch<{ plan: PlanWithDetails }>(
            `/api/households/${householdId}/plans/${planId}`,
            data
        )
        return response.plan
    },

    async deletePlan(householdId: string, planId: string): Promise<void> {
        await apiClient.delete(`/api/households/${householdId}/plans/${planId}`)
    },

    async updateSlots(
        householdId: string,
        planId: string,
        slots: Array<{ slotNumber: number; tagIds: string[]; maxCookingTimeMinutes?: number | null; pickedRecipeId?: string | null; pinned?: boolean }>
    ): Promise<PlanWithDetails> {
        const response = await apiClient.put<{ plan: PlanWithDetails }>(
            `/api/households/${householdId}/plans/${planId}/slots`,
            { slots }
        )
        return response.plan
    },

    async updateRoutes(
        householdId: string,
        planId: string,
        routes: Array<{ ingredientId: string; storeId?: string | null; overridden?: boolean; checked?: boolean }>
    ): Promise<PlanWithDetails> {
        const response = await apiClient.put<{ plan: PlanWithDetails }>(
            `/api/households/${householdId}/plans/${planId}/routes`,
            { routes }
        )
        return response.plan
    },

    async rerollSlots(
        householdId: string,
        planId: string,
        slots: number[]
    ): Promise<PlanWithDetails> {
        const response = await apiClient.post<{ plan: PlanWithDetails }>(
            `/api/households/${householdId}/plans/${planId}/reroll`,
            { slots }
        )
        return response.plan
    },

    async dispatchPlan(
        householdId: string,
        planId: string
    ): Promise<{ plan: Plan; itemsAdded: number; itemsSkipped: number }> {
        const response = await apiClient.post<{ plan: Plan; itemsAdded: number; itemsSkipped: number }>(
            `/api/households/${householdId}/plans/${planId}/dispatch`,
            {}
        )
        return response
    },

    async getPlansHistory(
        householdId: string,
        offset: number,
        limit: number
    ): Promise<PlanHistoryResponse> {
        return apiClient.get<PlanHistoryResponse>(
            `/api/households/${householdId}/plans/history?offset=${offset}&limit=${limit}`
        )
    },
}

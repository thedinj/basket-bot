import { AuthenticatedRequest, withAuth } from "@/lib/auth/withAuth"
import * as householdRepo from "@/lib/repos/householdRepo"
import * as itemRepo from "@/lib/repos/itemRepo"
import * as recipeRepo from "@/lib/repos/recipeRepo"
import * as shoppingListRepo from "@/lib/repos/shoppingListRepo"
import { roundFactor } from "@/lib/utils/math"
import { addRecipeToShoppingListRequestSchema } from "@basket-bot/core"
import { NextResponse } from "next/server"

async function handlePost(
    req: AuthenticatedRequest,
    { params }: { params: Promise<Record<string, string>> }
) {
    try {
        const { householdId, recipeId } = await params

        if (!householdRepo.userIsMember(householdId, req.auth.sub)) {
            return NextResponse.json({ code: "ACCESS_DENIED", message: "Access denied" }, { status: 403 })
        }

        const recipe = recipeRepo.getRecipeWithDetails(recipeId)
        if (!recipe || recipe.householdId !== householdId) {
            return NextResponse.json({ code: "RECIPE_NOT_FOUND", message: "Recipe not found" }, { status: 404 })
        }

        const body = await req.json()
        const parsed = addRecipeToShoppingListRequestSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid request" },
                { status: 400 }
            )
        }

        const { routes, factor } = parsed.data
        const ingredientSet = new Set(recipe.ingredients.filter((i) => !i.excluded).map((i) => i.id))

        let itemsCreated = 0
        let itemsSkipped = 0

        for (const route of routes) {
            if (!ingredientSet.has(route.ingredientId)) {
                itemsSkipped++
                continue
            }

            const ingredient = recipe.ingredients.find((i) => i.id === route.ingredientId)!
            const hasShoppingOverride = ingredient.shoppingQty !== null || ingredient.shoppingUnitId !== null
            const effectiveQty = hasShoppingOverride ? ingredient.shoppingQty : ingredient.qty
            const effectiveUnitId = hasShoppingOverride ? ingredient.shoppingUnitId : ingredient.unitId
            const scaledQty = effectiveQty != null ? roundFactor(effectiveQty * factor) : null

            const storeItem = itemRepo.getOrCreateStoreItemByName({
                storeId: route.storeId,
                name: ingredient.shoppingName ?? ingredient.name,
                createdById: req.auth.sub,
            })

            shoppingListRepo.upsertShoppingListItem({
                storeId: route.storeId,
                storeItemId: storeItem.id,
                qty: scaledQty,
                unitId: effectiveUnitId ?? null,
                notes: recipe.name,
                userId: req.auth.sub,
            })

            itemsCreated++
        }

        return NextResponse.json({ itemsCreated, itemsSkipped })
    } catch (error: any) {
        console.error("Add recipe to shopping list error:", error)
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    }
}

export const POST = withAuth(handlePost)

# Meals Tab - Design Document

**Status:** Draft
**Created:** 2026-02-22
**Last Updated:** 2026-02-24

---

## Overview

The Meals tab adds recipe management and meal planning capabilities to Basket Bot. Users can:

- Create and manage recipes with ingredients, steps (markdown), and tags
- Organize recipes with a normalized tag system for filtering
- Select recipes for meal planning (with tag-based filtering and randomness) and add their ingredients to shopping lists
- Automatically map recipe ingredients to shopping lists (via LLM-powered mapping to store items when needed)

---

## Design Decisions

### 1. Ownership Model

**Decision:** Household-owned entities only
**Rationale:** Recipe management is inherently a household activity. Recipes belong to the household context, not individual users. While meal planning is an ephemeral workflow, the recipes themselves are household resources.

### 2. Tag Structure

**Decision:** Normalized tag system with junction table
**Rationale:** Better filtering, searching, and querying capabilities. Supports multi-tag filtering efficiently (e.g., "winter AND vegetarian"). Tags are household-scoped for consistency.

### 3. Recipe Ingredients

**Decision:** Store-agnostic, name-based ingredients (no direct StoreItem foreign keys)
**Rationale:**

- Recipes should work across multiple stores (generic "flour" maps to different store items)
- Ingredients survive store item deletion/reorganization
- More flexible than rigid FK constraints

### 4. Recipe Steps

**Decision:** Single markdown text field
**Rationale:** Supports free-form prose, formatting, and rich text. Simpler than separate RecipeStep entities. Nice editor can be added in UI layer.

### 5. Ingredient Mapping

**Decision:** LLM-assisted auto-categorization when adding to shopping list, if a matching store item does not exist for that store.
**Rationale:** Consistent with app's existing LLM features (auto-categorize store items). User selects recipes, LLM maps ingredient names to StoreItems (or suggests creating new ones).

### 6. Meal Plan Persistence

**Decision:** Ephemeral (not stored in database)
**Rationale:** Meal planning is a selection workflow, not a persistent entity. Users filter/select recipes, then add ingredients to shopping lists. No need to store meal plan state—recipes and shopping lists are the persistent entities.

---

## Data Model

### Entity Relationship Overview

```
Household (1) ──┬──> Recipe (N) ──┬──> RecipeIngredient (N) ──> QuantityUnit (0..1)
                │                 └──> RecipeTagAssignment (N) ──> RecipeTag (N)
                │
                └──> RecipeTag (N)
```

### Database Tables

#### 1. Recipe

Core recipe entity with metadata and markdown steps.

**Columns:**

- `id` TEXT NOT NULL PRIMARY KEY
- `householdId` TEXT NOT NULL → FK to `Household` (ON DELETE CASCADE)
- `name` TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 200)
- `description` TEXT CHECK("description" IS NULL OR length("description") <= 2000)
- `steps` TEXT CHECK("steps" IS NULL OR length("steps") <= 50000)
- `sourceUrl` TEXT CHECK("sourceUrl" IS NULL OR length("sourceUrl") <= 500)
- `isHidden` INTEGER (NULL = false, 1 = true, follows app boolean convention)
- `createdById` TEXT NOT NULL → FK to `User` (ON DELETE RESTRICT)
- `updatedById` TEXT NOT NULL → FK to `User` (ON DELETE RESTRICT)
- `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
- `updatedAt` DATETIME NOT NULL

**Indexes:**

- `CREATE INDEX "Recipe_householdId_isHidden_name_idx" ON "Recipe"("householdId", "isHidden", "name")`

**Notes:**

- `isHidden` allows "soft" hiding recipes without deletion
- `steps` stored as markdown - frontend will implement rich editor
- `sourceUrl` for attributing recipes from external sources

---

#### 2. RecipeTag

Normalized tags for categorizing recipes (e.g., "winter", "vegetarian", "quick").

**Columns:**

- `id` TEXT NOT NULL PRIMARY KEY
- `householdId` TEXT NOT NULL → FK to `Household` (ON DELETE CASCADE)
- `name` TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 50)
- `color` TEXT CHECK("color" IS NULL OR length("color") <= 255)
- `createdById` TEXT NOT NULL → FK to `User` (ON DELETE RESTRICT)
- `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP

**Constraints:**

- `UNIQUE("householdId", "name" COLLATE NOCASE)` - case-insensitive unique tags per household

**Indexes:**

- `CREATE INDEX "RecipeTag_householdId_name_idx" ON "RecipeTag"("householdId", "name")`

**Notes:**

- `color` stores CSS color (e.g., "#FF5733") for UI display
- Tags are household-scoped (different households can have same tag names)
- No `updatedById`/`updatedAt` - tags are simple, create-only entities

---

#### 3. RecipeTagAssignment

Junction table linking recipes to tags (many-to-many).

**Columns:**

- `id` TEXT NOT NULL PRIMARY KEY
- `recipeId` TEXT NOT NULL → FK to `Recipe` (ON DELETE CASCADE)
- `tagId` TEXT NOT NULL → FK to `RecipeTag` (ON DELETE CASCADE)
- `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP

**Constraints:**

- `UNIQUE("recipeId", "tagId")` - prevent duplicate tag assignments

**Indexes:**

- `CREATE INDEX "RecipeTagAssignment_recipeId_idx" ON "RecipeTagAssignment"("recipeId")`
- `CREATE INDEX "RecipeTagAssignment_tagId_idx" ON "RecipeTagAssignment"("tagId")`

**Notes:**

- Deleting recipe removes all tag assignments (CASCADE)
- Deleting tag removes all assignments (CASCADE)

---

#### 4. RecipeIngredient

Ingredients for a recipe with optional quantities and units.

**Columns:**

- `id` TEXT NOT NULL PRIMARY KEY
- `recipeId` TEXT NOT NULL → FK to `Recipe` (ON DELETE CASCADE)
- `name` TEXT NOT NULL CHECK(length("name") >= 1 AND length("name") <= 200)
- `qty` REAL (nullable, amount)
- `unitId` TEXT → FK to `QuantityUnit` (ON DELETE SET NULL)
- `sortOrder` INTEGER NOT NULL DEFAULT 0
- `notes` TEXT CHECK("notes" IS NULL OR length("notes") <= 500)
- `createdById` TEXT NOT NULL → FK to `User` (ON DELETE RESTRICT)
- `updatedById` TEXT NOT NULL → FK to `User` (ON DELETE RESTRICT)
- `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
- `updatedAt` DATETIME NOT NULL

**Indexes:**

- `CREATE INDEX "RecipeIngredient_recipeId_sortOrder_idx" ON "RecipeIngredient"("recipeId", "sortOrder")`

**Notes:**

- `name` is free-text (e.g., "all-purpose flour", "large eggs")
- No foreign key to `StoreItem` - keeps recipes store-agnostic
- `sortOrder` controls display order in ingredient list
- `notes` for qualifiers (e.g., "divided", "plus extra for dusting")
- `qty` + `unitId` optional (some ingredients don't have measurements)

---

## Implementation Plan

### Phase 1: Database Schema

**1.1 Create Migration**

- File: `apps/backend/src/db/migrations/20260222_100000_add_recipe_tables.ts`
- Implement `up()` function with all 4 CREATE TABLE statements (Recipe, RecipeTag, RecipeTagAssignment, RecipeIngredient)
- Implement `down()` function with DROP TABLE in reverse order
- Include all CHECK constraints, foreign keys, indexes
- Follow existing migration patterns from `migrate.ts`

**1.2 Update Init Script**

- File: `apps/backend/src/db/init.ts`
- Add identical CREATE TABLE statements after `ShoppingListItem` (before `RefreshToken`)
- Ensure perfect sync with migration file
- Required for fresh database initialization and tests

**1.3 Run Migration**

- Command: `pnpm db:migrate` (from `apps/backend/`)
- Verify all tables created: `sqlite3 db/basket.db ".schema Recipe"`
- Test cascade behavior with manual inserts/deletes

---

### Phase 2: Core Schemas (Zod)

**2.1 Create Recipe Schemas**

- File: `packages/core/src/schemas/recipe.ts` (new)
- Schemas:
    - `recipeSchema` - base entity with audit fields
    - `recipeWithDetailsSchema` - extends base, adds `tags: RecipeTag[]`, `ingredients: RecipeIngredient[]`
    - `createRecipeRequestSchema` - name, description, steps, sourceUrl
    - `updateRecipeRequestSchema` - partial of create schema
    - `recipeTagSchema` - base RecipeTag entity
    - `createRecipeTagRequestSchema` - name, color
    - `updateRecipeTagRequestSchema` - partial
    - `recipeIngredientSchema` - base RecipeIngredient entity
    - `addRecipeIngredientRequestSchema` - name, qty, unitId, sortOrder, notes
    - `updateRecipeIngredientRequestSchema` - partial
- Export inferred types (e.g., `export type Recipe = z.infer<typeof recipeSchema>`)
- Use `minMaxLengthString` and `maxLengthString` helpers from `zodHelpers.ts`
- Follow patterns from `store.ts`
- Note: `color` field in RecipeTag should use `maxLengthString(255)` to support both hex codes (#FF5733) and CSS color names (red, blue, etc.)

**2.2 Update Core Package Exports**

- File: `packages/core/src/index.ts`
- Add: `export * from './schemas/recipe';`

**2.3 Build Core Package**

- Command: `pnpm --filter @basket-bot/core build`
- Verify no errors
- Test imports in backend: `import { recipeSchema } from '@basket-bot/core'`

---

### Phase 3: Repository Layer

**3.1 Create Recipe Repository**

- File: `apps/backend/src/lib/repos/recipeRepository.ts` (new)
- Functions:
    - `createRecipe(data, userId)` - insert with audit fields
    - `getRecipeById(id)` - basic fetch
    - `getRecipesByHousehold(householdId, includeHidden)` - filtered list
    - `getRecipeWithDetails(id)` - joins tags and ingredients
    - `updateRecipe(id, data, userId)` - update with audit
    - `deleteRecipe(id)` - hard delete (cascades to ingredients/tags)
    - `hideRecipe(id, userId)` - set isHidden = 1
    - `unhideRecipe(id, userId)` - set isHidden = NULL
    - `searchRecipesByTags(householdId, tagIds)` - filter by tags (supports multiple tag filtering)
- Use `boolToInt()` / `intToBool()` for isHidden
- Follow patterns from `storeRepository.ts`

**3.2 Create Recipe Tag Repository**

- File: `apps/backend/src/lib/repos/recipeTagRepository.ts` (new)
- Functions:
    - `createTag(householdId, name, color, userId)`
    - `getTagById(id)`
    - `getTagsByHousehold(householdId)`
    - `updateTag(id, name, color)` - update name and/or color
    - `deleteTag(id)` - cascades to assignments
    - `assignTagToRecipe(recipeId, tagId)`
    - `removeTagFromRecipe(recipeId, tagId)`
    - `getTagsForRecipe(recipeId)` - fetch all tags for a recipe
    - `getRecipesForTag(tagId)` - fetch all recipes with a tag

**3.3 Create Recipe Ingredient Repository**

- File: `apps/backend/src/lib/repos/recipeIngredientRepository.ts` (new)
- Functions:
    - `addIngredient(recipeId, data, userId)` - insert with audit fields
    - `getIngredientsByRecipe(recipeId)` - ordered by sortOrder
    - `updateIngredient(id, data, userId)` - partial update with audit
    - `deleteIngredient(id)`
    - `reorderIngredients(recipeId, ingredientIds)` - bulk update sortOrder

---

### Phase 4: Service Layer (Future - API Implementation)

**Services to be implemented:**

- `recipeService.ts` - business logic + authorization (household membership checks)
- Follow patterns from existing services in `apps/backend/src/lib/services/`

**Key service features:**

- Verify user is household member before recipe operations
- Handle tag assignment/removal
- Bulk ingredient operations (add multiple ingredients to recipe)
- **LLM Integration Point:** When user selects recipes and clicks "Add to Shopping List":
    - Accept array of recipe IDs and target store ID
    - For each ingredient in selected recipes:
        - Check if matching StoreItem exists (by normalized name)
        - If exists: use existing storeItemId
        - If not: call LLM to categorize and create new StoreItem
        - Create ShoppingListItem with qty/unit from recipe ingredient

---

### Phase 5: API Routes (Future)

**Routes to be implemented:**

- `POST /api/recipes` - create recipe
- `GET /api/recipes?householdId=X` - list household recipes (supports tag filtering via query params)
- `GET /api/recipes/:id` - get recipe with details
- `PATCH /api/recipes/:id` - update recipe
- `DELETE /api/recipes/:id` - delete recipe
- `PATCH /api/recipes/:id/hide` - hide recipe
- `PATCH /api/recipes/:id/unhide` - unhide recipe
- `POST /api/recipes/:id/ingredients` - add ingredient
- `PATCH /api/recipes/:id/ingredients/:ingredientId` - update ingredient
- `DELETE /api/recipes/:id/ingredients/:ingredientId` - delete ingredient
- `POST /api/recipes/:id/tags` - assign tag
- `DELETE /api/recipes/:id/tags/:tagId` - remove tag
- `POST /api/recipe-tags` - create tag
- `GET /api/recipe-tags?householdId=X` - list household tags
- `PATCH /api/recipe-tags/:id` - update tag
- `DELETE /api/recipe-tags/:id` - delete tag
- `POST /api/recipes/add-to-shopping-list` - add selected recipes' ingredients to shopping list (LLM-powered mapping)
    - Request body: `{ recipeIds: string[], storeId: string }`
    - Response: summary of created ShoppingListItems

All routes protected with `withAuth()`, household membership verified.

---

### Phase 6: Mobile UI (Future)

**Screens to be implemented:**

- Recipe List (with tag filters, search, multi-select for adding to shopping list)
- Recipe Detail (view/edit mode)
- Recipe Form (create/edit with markdown editor for steps)
- Ingredient Editor (inline add/edit/reorder ingredients)
- Tag Management (create/edit/delete tags with color picker)
- Meal Planning Modal (ephemeral UI):
    - Filter recipes by tags
    - Random selection option
    - Select multiple recipes
    - Preview total ingredient list
    - Choose target store
    - "Add to Shopping List" action (triggers LLM mapping)

**UI Patterns:**

- Use Ionic components, TanStack Query for server state
- Tag filter UI: multi-select chips with AND/OR toggle
- Recipe multi-select: checkboxes in list view
- Markdown editor: consider using a library like `react-simplemde-editor` or similar
- Follow existing mobile patterns from store/shopping list features

---

## Verification Checklist

### After Database Schema Implementation

- [ ] Migration file created with up/down functions
- [ ] Init.ts updated with identical CREATE TABLE statements
- [ ] Run `pnpm db:migrate` successfully
- [ ] Verify all 4 tables exist: `sqlite3 db/basket.db ".schema Recipe"`
- [ ] Test cascade deletes work correctly (deleting recipe removes ingredients/tag assignments)
- [ ] Test unique constraints (duplicate tags per household, duplicate tag assignments)

### After Zod Schema Implementation

- [ ] Core package builds without errors
- [ ] Backend can import schemas: `import { recipeSchema } from '@basket-bot/core'`
- [ ] Type inference works: `type Recipe = z.infer<typeof recipeSchema>`
- [ ] All field types match database schema (TEXT→string, INTEGER→number, etc.)
- [ ] Nullability matches (nullable fields use `.nullable()`)

### After Repository Implementation

- [ ] Create test recipes with ingredients and tags
- [ ] Verify household-scoped queries (only household members see recipes)
- [ ] Test cascade deletes (deleting recipe removes ingredients/tags)
- [ ] Test unique constraints in repositories
- [ ] Test boolean conversion (isHidden stores NULL/1, reads as true/false)
- [ ] Test sortOrder for ingredients (maintains display order)

---

## Open Questions / Future Considerations

### 1. Recipe Sharing Across Households

**Question:** Should recipes be shareable between households (e.g., public recipe library)?
**Current:** Recipes are household-scoped only. Each household maintains its own recipe collection.
**Future Option:** Add `isPublic` flag + global recipe browsing/import feature.

### 2. Nutrition Information

**Question:** Should recipes track nutrition data (calories, macros, etc.)?
**Current:** Not included in initial schema.
**Future Option:** Add `Recipe.nutritionJson` TEXT field storing structured nutrition data, or create separate `RecipeNutrition` table.

### 3. Recipe Photos

**Question:** Should recipes support photos?
**Current:** Not included.
**Future Option:** Add image upload/storage system (file storage + `Recipe.imageUrl`).

### 4. Ingredient Substitutions

**Question:** Should recipes support ingredient substitutions (e.g., "butter OR margarine")?
**Current:** Not supported.
**Future Option:** Add `RecipeIngredient.substitutes` TEXT array or separate `RecipeIngredientSubstitute` table.

### 5. Recipe Ratings/Comments

**Question:** Should household members be able to rate or comment on recipes?
**Current:** Not included.
**Future Option:** Add `RecipeRating` and `RecipeComment` tables with user references.

### 6. Multi-Store Recipe Addition

**Question:** Should adding recipes to shopping list support multiple target stores at once?
**Current:** User selects one target store per operation.
**Future Option:** Let user select multiple target stores, LLM maps ingredients to best matches in each store simultaneously.

### 7. Recipe Versioning

**Question:** Should we track recipe edit history?
**Current:** No versioning - updates overwrite.
**Future Option:** Add `RecipeVersion` table to preserve edit history.

### 8. Servings and Scaling

**Question:** Should recipes track servings and allow scaling quantities?
**Current:** No servings field - ingredients have fixed quantities.
**Future Option:** Add `Recipe.servings` INTEGER field, allow users to scale ingredient quantities when adding to shopping list (e.g., "2x this recipe").

### 9. LLM Caching / Learning

**Question:** Should the app cache LLM ingredient mappings to speed up future operations?
**Current:** LLM called fresh each time an unknown ingredient is encountered.
**Future Option:** Create `IngredientMapping` table caching household-specific ingredient→StoreItem mappings per store.

---

## References

- [Database Schema](apps/backend/src/db/init.ts) - Existing table patterns
- [Store Schema](packages/core/src/schemas/store.ts) - Zod schema patterns
- [Store Repository](apps/backend/src/lib/repos/storeRepository.ts) - Repository patterns
- [Migration System](apps/backend/src/db/migrate.ts) - Migration runner
- [Copilot Instructions](.github/copilot-instructions.md) - Project conventions

---

**Next Steps:**

1. Review and refine this design document
2. Implement Phase 1 (Database Schema)
3. Implement Phase 2 (Core Schemas)
4. Implement Phase 3 (Repositories)
5. Move to service/API/UI implementation

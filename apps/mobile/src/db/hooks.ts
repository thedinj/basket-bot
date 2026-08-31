/**
 * Barrel for the entity-scoped hook files this module was split out of.
 *
 * The hooks themselves live in `storeHooks.ts`, `aisleHooks.ts`, `sectionHooks.ts`,
 * `itemHooks.ts`, `shoppingListHooks.ts`, `invitationHooks.ts` and `householdHooks.ts`,
 * with the pieces they share (`useDatabase`, the sort helpers, `CORE_DATA_CACHE`) in
 * `hooksShared.ts`. `mealsHooks.ts` predates the split and is imported directly, not
 * re-exported here.
 *
 * This file exists so the ~100 existing `from "../db/hooks"` imports keep working. New
 * code should import from the entity file it actually needs — that's the point of the
 * split, and it keeps the dependency visible at the import site.
 */
export * from "./aisleHooks";
export * from "./householdHooks";
export * from "./hooksShared";
export * from "./invitationHooks";
export * from "./itemHooks";
export * from "./sectionHooks";
export * from "./shoppingListHooks";
export * from "./storeHooks";

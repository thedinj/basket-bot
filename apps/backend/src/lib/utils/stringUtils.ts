/**
 * Re-exported from `@basket-bot/core` so the backend (which writes every stored `nameNorm`)
 * and the mobile client cannot drift apart again. See the notes in
 * `packages/core/src/utils/normalizeName.ts` for why that mattered.
 */
export { normalizeItemName } from "@basket-bot/core";

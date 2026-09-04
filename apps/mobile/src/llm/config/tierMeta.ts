/**
 * How each capability tier is described in Settings.
 *
 * Separate from the tier definition itself because these are user-facing words about what
 * the tier is *for* — the thing someone needs in order to decide whether overriding it is
 * worth doing. Adding a tier is one entry here plus the compile errors it raises.
 */

import type { LLMTier } from "@basket-bot/core";

export const LLM_TIER_META: Record<LLMTier, { label: string; helperText: string }> = {
    fast: {
        label: "Fast model",
        helperText: "High-volume work: categorizing individual items",
    },
    smart: {
        label: "Smart model",
        helperText: "Parsing pasted lists and recipes",
    },
    vision: {
        label: "Vision model",
        helperText: "Anything with a photo attached, including store scans",
    },
};

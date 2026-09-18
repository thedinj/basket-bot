/** 1.5 → "1.5", 0.25 → "0.25", 2 → "2". Trims float noise (0.1 + 0.2 → "0.3"). */
export const formatQuantity = (qty: number): string => String(Number(qty.toFixed(2)));

/**
 * The amount shown beside an item name: "1.5 cup", "3", "jar". Empty when there's neither a
 * quantity nor a unit.
 */
export const formatQuantityWithUnit = (qty: number | null, unit: string | null | undefined) =>
    [qty !== null ? formatQuantity(qty) : null, unit || null].filter(Boolean).join(" ");

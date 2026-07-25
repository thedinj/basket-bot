// Auth constants
export const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const MIN_PASSWORD_LENGTH = 6;

// Text field length limits
export * from "./textLimits";

// Recipe tag palette keys — maps to CSS variables --tag-{key}-bg/border/text in both themes
export const TAG_PALETTE_KEYS = [
    "rose",
    "amber",
    "emerald",
    "sky",
    "violet",
    "pink",
    "teal",
    "indigo",
    "orange",
    "lime",
] as const;

export type TagPaletteKey = (typeof TAG_PALETTE_KEYS)[number];

// Scopes
export const ADMIN_SCOPE = "admin";

// Quantity Units — must stay in sync with the QuantityUnit seed rows in
// apps/backend/src/db/init.ts (fresh databases) and the corresponding migrations
// (existing databases). Same ids, names, abbreviations, sortOrder, and category.
export const QUANTITY_UNITS = [
    { id: "milligram", name: "Milligram", abbreviation: "mg", sortOrder: 9, category: "weight" },
    { id: "gram", name: "Gram", abbreviation: "g", sortOrder: 10, category: "weight" },
    { id: "kilogram", name: "Kilogram", abbreviation: "kg", sortOrder: 11, category: "weight" },
    { id: "ounce", name: "Ounce", abbreviation: "oz", sortOrder: 12, category: "weight" },
    { id: "pound", name: "Pound", abbreviation: "lb", sortOrder: 13, category: "weight" },
    { id: "milliliter", name: "Milliliter", abbreviation: "ml", sortOrder: 20, category: "volume" },
    { id: "liter", name: "Liter", abbreviation: "l", sortOrder: 21, category: "volume" },
    {
        id: "fluid-ounce",
        name: "Fluid Ounce",
        abbreviation: "fl oz",
        sortOrder: 22,
        category: "volume",
    },
    { id: "quart", name: "Quart", abbreviation: "qt", sortOrder: 23, category: "volume" },
    { id: "cup", name: "Cup", abbreviation: "cup", sortOrder: 24, category: "volume" },
    { id: "gallon", name: "Gallon", abbreviation: "gal", sortOrder: 25, category: "volume" },
    {
        id: "tablespoon",
        name: "Tablespoon",
        abbreviation: "tbsp",
        sortOrder: 26,
        category: "volume",
    },
    { id: "teaspoon", name: "Teaspoon", abbreviation: "tsp", sortOrder: 27, category: "volume" },
    { id: "count", name: "Count", abbreviation: "ct", sortOrder: 30, category: "count" },
    { id: "dozen", name: "Dozen", abbreviation: "doz", sortOrder: 31, category: "count" },
    { id: "package", name: "Package", abbreviation: "pkg", sortOrder: 40, category: "package" },
    { id: "can", name: "Can", abbreviation: "can", sortOrder: 41, category: "package" },
    { id: "box", name: "Box", abbreviation: "box", sortOrder: 42, category: "package" },
    { id: "bag", name: "Bag", abbreviation: "bag", sortOrder: 43, category: "package" },
    { id: "bottle", name: "Bottle", abbreviation: "btl", sortOrder: 44, category: "package" },
    { id: "jar", name: "Jar", abbreviation: "jar", sortOrder: 45, category: "package" },
    { id: "bunch", name: "Bunch", abbreviation: "bunch", sortOrder: 50, category: "other" },
] as const;

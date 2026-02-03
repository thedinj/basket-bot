// Auth constants
export const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const MIN_PASSWORD_LENGTH = 6;

// Text field length limits
export * from "./textLimits";

// Role hierarchy
export const ROLE_HIERARCHY = {
    owner: 3,
    editor: 2,
    viewer: 1,
} as const;

// Scopes
export const ADMIN_SCOPE = "admin";

// Quantity Units
export const QUANTITY_UNITS = [
    { id: "unit", name: "Unit", abbreviation: "unit", sortOrder: 1, category: "count" },
    { id: "lb", name: "Pound", abbreviation: "lb", sortOrder: 2, category: "weight" },
    { id: "oz", name: "Ounce", abbreviation: "oz", sortOrder: 3, category: "weight" },
    { id: "kg", name: "Kilogram", abbreviation: "kg", sortOrder: 4, category: "weight" },
    { id: "g", name: "Gram", abbreviation: "g", sortOrder: 5, category: "weight" },
    { id: "gal", name: "Gallon", abbreviation: "gal", sortOrder: 6, category: "volume" },
    { id: "qt", name: "Quart", abbreviation: "qt", sortOrder: 7, category: "volume" },
    { id: "pt", name: "Pint", abbreviation: "pt", sortOrder: 8, category: "volume" },
    { id: "cup", name: "Cup", abbreviation: "cup", sortOrder: 9, category: "volume" },
    { id: "fl-oz", name: "Fluid Ounce", abbreviation: "fl oz", sortOrder: 10, category: "volume" },
    { id: "tbsp", name: "Tablespoon", abbreviation: "tbsp", sortOrder: 11, category: "volume" },
    { id: "tsp", name: "Teaspoon", abbreviation: "tsp", sortOrder: 12, category: "volume" },
    { id: "l", name: "Liter", abbreviation: "L", sortOrder: 13, category: "volume" },
    { id: "ml", name: "Milliliter", abbreviation: "mL", sortOrder: 14, category: "volume" },
] as const;

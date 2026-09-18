import type { StoreTemplateSummary } from "@basket-bot/core";

/**
 * Starting layouts a user can pick when creating a store.
 *
 * This catalog is **server-side only**. The client discovers it through
 * `GET /api/stores/templates` and renders whatever comes back, so adding a template (a
 * hardware store, a pharmacy, a warehouse club) is a change to this one file — no schema
 * migration, no API change, no mobile release.
 *
 * Layouts are deliberately department-shaped rather than shelf-accurate: the point is a
 * store a family can shop from immediately without running the AI store scan, which they
 * can then tune. Sections exist only where shoppers actually distinguish them, so the big
 * center aisles are subdivided and the small perimeter departments stay flat.
 */

/**
 * An aisle in a template, with the sections nested under it (display order = array order) and
 * the emoji shown on its plate in the shopping list.
 */
type TemplateAisle = {
    name: string;
    emoji?: string;
    sections?: readonly string[];
};

/**
 * A demo row seeded only when a caller explicitly asks for sample items (registration).
 * `location` names must resolve inside the template's own aisles/sections — enforced by
 * `storeTemplates.test.ts`, so editing a layout can never silently orphan an item.
 */
type TemplateSampleItem = {
    name: string;
    /** An item lives under an aisle *or* a section, never both — the app's placement rule. */
    location: { aisle: string; section?: string };
    qty: number | null;
    /** A `QuantityUnit` id (e.g. "gallon", "pound"), not a display label. FK-checked. */
    unitId: string | null;
    notes: string | null;
};

export type StoreTemplateDefinition = {
    id: string;
    label: string;
    description: string;
    aisles: readonly TemplateAisle[];
    sampleItems: readonly TemplateSampleItem[];
};

/**
 * A general-purpose US supermarket walk order. Reviewed against a real, hand-built store
 * layout to catch the everyday sections a from-scratch list tends to miss (peanut butter &
 * jelly, snack bars, first aid, light bulbs & batteries).
 */
const GROCERY_AISLES: readonly TemplateAisle[] = [
    {
        name: "Produce",
        emoji: "🥬",
        sections: ["Fruit", "Vegetables", "Fresh Herbs", "Salads & Pre-Cut"],
    },
    { name: "Bakery", emoji: "🥖", sections: ["Bread", "Buns & Tortillas", "Desserts"] },
    { name: "Deli", emoji: "🧀", sections: ["Sliced Meat & Cheese", "Prepared Foods"] },
    {
        name: "Meat & Seafood",
        emoji: "🥩",
        sections: ["Beef", "Poultry", "Pork", "Bacon & Sausage", "Seafood"],
    },
    {
        name: "Dairy & Eggs",
        emoji: "🥛",
        sections: ["Milk & Cream", "Cheese", "Yogurt", "Eggs", "Butter"],
    },
    {
        name: "Frozen Foods",
        emoji: "🧊",
        sections: [
            "Frozen Meals & Pizza",
            "Frozen Vegetables & Fruit",
            "Ice Cream",
            "Frozen Breakfast",
        ],
    },
    {
        name: "Breakfast & Spreads",
        emoji: "🥣",
        sections: ["Cereal", "Oatmeal & Grits", "Peanut Butter & Jelly", "Syrup & Honey"],
    },
    { name: "Coffee & Tea", emoji: "☕" },
    {
        name: "Canned & Jarred Goods",
        emoji: "🥫",
        sections: [
            "Soup & Broth",
            "Canned Vegetables",
            "Canned Fruit",
            "Beans",
            "Canned Meat & Fish",
        ],
    },
    {
        name: "Pasta, Rice & Grains",
        emoji: "🍝",
        sections: ["Pasta & Noodles", "Pasta Sauce", "Rice & Grains"],
    },
    {
        name: "Baking & Spices",
        emoji: "🧂",
        sections: ["Flour & Sugar", "Baking Mixes", "Spices & Seasoning", "Oils & Vinegar"],
    },
    {
        name: "Condiments & Sauces",
        emoji: "🍯",
        sections: ["Condiments", "Salad Dressing", "Pickles & Olives", "Marinades & Sauces"],
    },
    {
        name: "Snacks",
        emoji: "🍿",
        sections: [
            "Chips & Pretzels",
            "Crackers",
            "Popcorn",
            "Cookies",
            "Candy",
            "Granola & Snack Bars",
            "Nuts & Dried Fruit",
        ],
    },
    {
        name: "Beverages",
        emoji: "🥤",
        sections: ["Soda", "Water", "Juice", "Sports & Energy Drinks"],
    },
    { name: "International", emoji: "🌮" },
    { name: "Baby", emoji: "🍼", sections: ["Diapers & Wipes", "Baby Food & Formula"] },
    {
        name: "Health & Beauty",
        emoji: "💊",
        sections: [
            "Medicine & Vitamins",
            "First Aid",
            "Hair & Skin",
            "Oral Care",
            "Deodorant & Shaving",
        ],
    },
    {
        name: "Paper & Cleaning",
        emoji: "🧻",
        sections: ["Paper Goods", "Cleaning Supplies", "Laundry", "Trash Bags", "Food Storage"],
    },
    {
        name: "Household",
        emoji: "💡",
        sections: ["Light Bulbs & Batteries", "Kitchen & Home", "Cards & Party"],
    },
    { name: "Pet", emoji: "🐾" },
    { name: "Wine, Beer & Liquor", emoji: "🍷" },
] as const;

/**
 * One item per major department, so a brand-new user's first shopping list demonstrates
 * grouping by aisle rather than showing a single lonely row.
 */
const GROCERY_SAMPLE_ITEMS: readonly TemplateSampleItem[] = [
    {
        name: "Bananas",
        location: { aisle: "Produce", section: "Fruit" },
        qty: 1,
        unitId: "bunch",
        notes: "Ripe, not green",
    },
    {
        name: "Milk",
        location: { aisle: "Dairy & Eggs", section: "Milk & Cream" },
        qty: 1,
        unitId: "gallon",
        notes: null,
    },
    {
        name: "Eggs",
        location: { aisle: "Dairy & Eggs", section: "Eggs" },
        qty: 1,
        unitId: "dozen",
        notes: null,
    },
    {
        name: "French Bread",
        location: { aisle: "Bakery", section: "Bread" },
        qty: null,
        unitId: null,
        notes: null,
    },
    {
        name: "Chicken Breast",
        location: { aisle: "Meat & Seafood", section: "Poultry" },
        qty: 2,
        unitId: "pound",
        notes: null,
    },
    {
        name: "Penne Pasta",
        location: { aisle: "Pasta, Rice & Grains", section: "Pasta & Noodles" },
        qty: null,
        unitId: null,
        notes: null,
    },
    {
        name: "Paper Towels",
        location: { aisle: "Paper & Cleaning", section: "Paper Goods" },
        qty: null,
        unitId: null,
        notes: null,
    },
];

/** Blank is a real entry (with empty arrays) so the picker, API and seeder share one path. */
export const BLANK_STORE_TEMPLATE_ID = "blank";

export const STORE_TEMPLATES: readonly StoreTemplateDefinition[] = [
    {
        id: BLANK_STORE_TEMPLATE_ID,
        label: "Blank store",
        description: "Start empty and add your own aisles and sections.",
        aisles: [],
        sampleItems: [],
    },
    {
        id: "grocery",
        label: "Grocery store",
        description:
            "A ready-to-shop supermarket layout — produce, bakery, meat, dairy, frozen, " +
            "center aisles and household.",
        aisles: GROCERY_AISLES,
        sampleItems: GROCERY_SAMPLE_ITEMS,
    },
] as const;

export function getStoreTemplate(id: string): StoreTemplateDefinition | undefined {
    return STORE_TEMPLATES.find((template) => template.id === id);
}

export function countTemplateSections(template: StoreTemplateDefinition): number {
    return template.aisles.reduce((total, aisle) => total + (aisle.sections?.length ?? 0), 0);
}

/**
 * The client-facing view of the catalog. Counts are derived rather than written by hand so
 * a description can never drift from the layout it describes.
 */
export function listStoreTemplateSummaries(): StoreTemplateSummary[] {
    return STORE_TEMPLATES.map((template) => ({
        id: template.id,
        label: template.label,
        description: template.description,
        aisleCount: template.aisles.length,
        sectionCount: countTemplateSections(template),
    }));
}

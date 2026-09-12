import { calendarOutline, cartOutline, restaurantOutline } from "ionicons/icons";

export interface AppTab {
    tab: string;
    href: string;
    icon: string;
    label: string;
}

/**
 * The bottom tab bar's tabs, in display order. Shared by `Main.tsx` (which renders the
 * `IonTabButton`s and the matching `Route`s) and `useTabNavigation` (which navigates between
 * them), so a tab's name and its href can never drift apart between the two.
 */
export const APP_TABS: readonly AppTab[] = [
    {
        tab: "shoppinglist",
        href: "/shoppinglist",
        icon: cartOutline,
        label: "Shopping List",
    },
    {
        tab: "recipes",
        href: "/recipes",
        icon: restaurantOutline,
        label: "Recipes",
    },
    {
        tab: "plans",
        href: "/plans",
        icon: calendarOutline,
        label: "Meal Plans",
    },
] as const;

export type AppTabName = "shoppinglist" | "recipes" | "plans";

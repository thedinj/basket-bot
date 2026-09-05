import { registerPlugin } from "@capacitor/core";

interface NavigationBarPlugin {
    setDarkIcons(options: { darkIcons: boolean }): Promise<void>;
}

/**
 * Custom native plugin (android/app/.../NavigationBarPlugin.java) filling a gap in
 * @capacitor/status-bar, which only controls the top status bar. Without it, the
 * bottom navigation bar's icon color follows the OS-level dark mode setting instead
 * of the app's own theme, and can render invisible against the app's background.
 */
const NavigationBar = registerPlugin<NavigationBarPlugin>("NavigationBar");

export const setNavigationBarDarkIcons = (darkIcons: boolean): void => {
    void NavigationBar.setDarkIcons({ darkIcons });
};

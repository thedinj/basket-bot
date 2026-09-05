import { Capacitor } from "@capacitor/core";
import { Style, StatusBar } from "@capacitor/status-bar";
import { setNavigationBarDarkIcons } from "./nativeNavigationBar";

export type ThemeMode = "system" | "light" | "dark";

export const applyTheme = (mode: string | null | undefined): void => {
    const isDark =
        mode === "dark"
            ? true
            : mode === "light"
              ? false
              : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.body.classList.toggle("ion-palette-dark", isDark);

    if (Capacitor.isNativePlatform()) {
        const background = getComputedStyle(document.body)
            .getPropertyValue("--ion-background-color")
            .trim();
        void StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
        if (background) {
            void StatusBar.setBackgroundColor({ color: background });
        }
        setNavigationBarDarkIcons(!isDark);
    }
};

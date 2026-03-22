export type ThemeMode = "system" | "light" | "dark";

export const applyTheme = (mode: string | null | undefined): void => {
    const isDark =
        mode === "dark"
            ? true
            : mode === "light"
              ? false
              : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.body.classList.toggle("ion-palette-dark", isDark);
};

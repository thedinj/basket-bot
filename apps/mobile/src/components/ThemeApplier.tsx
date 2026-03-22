import { useEffect } from "react";
import { usePreference } from "../hooks/usePreference";
import { applyTheme } from "../theme/applyTheme";

/**
 * Null-rendering component that syncs the "theme_mode" preference to
 * the `ion-palette-dark` body class. Handles system OS theme changes
 * when the preference is "system" (or absent).
 */
const ThemeApplier: React.FC = () => {
    const { value } = usePreference("theme_mode");

    useEffect(() => {
        applyTheme(value);

        if (!value || value === "system") {
            const mq = window.matchMedia("(prefers-color-scheme: dark)");
            const listener = () => applyTheme("system");
            mq.addEventListener("change", listener);
            return () => mq.removeEventListener("change", listener);
        }
    }, [value]);

    return null;
};

export default ThemeApplier;

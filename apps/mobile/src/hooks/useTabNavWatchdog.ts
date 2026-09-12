import { useEffect } from "react";
import { clientErrorLog } from "../lib/clientErrorLog";
import { APP_TABS } from "./appTabs";

/**
 * Records a diagnostic snapshot whenever a bottom-tab tap fails to take you anywhere.
 *
 * This exists because "I tapped Shopping List and nothing happened" is close to
 * undiagnosable after the fact: the failure has several plausible causes that look identical
 * from the outside (an overlay covering the bar, Ionic's tab state disagreeing with the
 * router, or a router outlet left with no visible page), and it only shows up intermittently
 * on a real device where no debugger is attached. So instead of inferring the cause, the app
 * captures the state at the moment it happens and writes it to the on-device debug log.
 *
 * Two failure shapes are caught:
 *  - the URL never became the tapped tab's href, or
 *  - the URL changed but the outlet has no visible page (every `.ion-page` hidden).
 *
 * Deliberately always on, not dev-only — the whole point is catching it in the field. The
 * cost is one capture-phase click listener plus a timer per tab tap.
 *
 * Read the results in the app: **app menu → About → tap the build row 7×**, then tap an entry
 * to copy it. Entries are tagged `operation: "tab-nav-stuck"`.
 */

/** How long to give the router to settle before calling a tab tap stuck. */
const SETTLE_MS = 900;
/** Suppress repeats of an identical signature, so one wedged session can't fill the log. */
const DEDUPE_MS = 30_000;

const safe = (fn: () => string): string => {
    try {
        return fn();
    } catch {
        return "?";
    }
};

/** Which pages the tab outlet is holding, and which of them is actually showing. */
const describePages = (): string =>
    safe(() => {
        const pages = [...document.querySelectorAll("#main-content > .ion-page")];
        if (pages.length === 0) return "none";
        return pages
            .map((p) => {
                const title = p.querySelector("ion-title")?.textContent?.trim() || "?";
                const hidden = p.classList.contains("ion-page-hidden");
                const invisible = p.classList.contains("ion-page-invisible");
                return `${title}${hidden ? "[hidden]" : "[VISIBLE]"}${invisible ? "[invisible]" : ""}`;
            })
            .join(" ");
    });

const countVisiblePages = (): number => {
    try {
        return [...document.querySelectorAll("#main-content > .ion-page")].filter(
            (p) => !p.classList.contains("ion-page-hidden")
        ).length;
    } catch {
        return -1;
    }
};

/** Anything currently presented that could be sitting over the tab bar. */
const describeOverlays = (): string =>
    safe(() => {
        const selector = "ion-modal, ion-alert, ion-action-sheet, ion-popover, .shield-overlay";
        const shown = [...document.querySelectorAll(selector)].filter(
            (el) => getComputedStyle(el).display !== "none"
        );
        if (shown.length === 0) return "none";
        return shown
            .map((el) => {
                const z = getComputedStyle(el).zIndex;
                const cls = String(el.className || "")
                    .split(/\s+/)
                    .filter(Boolean)
                    .join(".");
                return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}@z${z}`;
            })
            .join(" ");
    });

/**
 * What the browser's own hit test finds at the centre of the tapped button. If this is not
 * the tab button, something is physically covering it — which `describeOverlays` alone would
 * not prove, since an overlay can be present without covering the bar.
 */
const describeHitTest = (button: Element): string =>
    safe(() => {
        const r = button.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!el) return "null";
        const chain: string[] = [];
        let node: Element | null = el;
        while (node && chain.length < 4) {
            chain.push(node.tagName.toLowerCase());
            node = node.parentElement;
        }
        return chain.join("<");
    });

/** Attributes Ionic's overlays set on the app shell and are supposed to unwind on dismiss. */
const describeBlockers = (): string =>
    safe(() => {
        const found = ["ion-app", "ion-tabs", "ion-router-outlet", "ion-tab-bar"]
            .map((sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const flags: string[] = [];
                if (el.hasAttribute("inert")) flags.push("inert");
                const ariaHidden = el.getAttribute("aria-hidden");
                if (ariaHidden) flags.push(`aria-hidden=${ariaHidden}`);
                if (getComputedStyle(el).pointerEvents === "none")
                    flags.push("pointer-events:none");
                return flags.length > 0 ? `${sel}{${flags.join(",")}}` : null;
            })
            .filter(Boolean);
        return found.length > 0 ? found.join(" ") : "clean";
    });

/** Ionic's own idea of the selected tab — a public property on the tab bar element. */
const describeSelectedTab = (): string =>
    safe(() => {
        const bar = document.querySelector("ion-tab-bar") as
            | (Element & { selectedTab?: string })
            | null;
        return bar?.selectedTab ?? "undefined";
    });

export const useTabNavWatchdog = (): void => {
    useEffect(() => {
        const lastRecorded = new Map<string, number>();

        const handleClick = (event: MouseEvent) => {
            try {
                const target = event.target as Element | null;
                // Events from the button's shadow DOM are retargeted to the host, so this
                // finds the button whether the icon, the label or the padding was tapped.
                const button = target?.closest?.("ion-tab-button") ?? null;
                if (!button) return;

                const tab = button.getAttribute("tab");
                const href = APP_TABS.find((t) => t.tab === tab)?.href;
                if (!tab || !href) return;

                const from = window.location.pathname;
                // Tapping the tab you are already on is a legitimate no-op, not a failure.
                if (from === href) return;

                window.setTimeout(() => {
                    try {
                        const to = window.location.pathname;
                        const routeStuck = to !== href;
                        const noVisiblePage = countVisiblePages() === 0;
                        if (!routeStuck && !noVisiblePage) return;

                        const reason = routeStuck ? "route-unchanged" : "no-visible-page";
                        const hitTest = describeHitTest(button);
                        const blockers = describeBlockers();
                        const overlays = describeOverlays();

                        // One signature per cause, so a session stuck in one state records
                        // once rather than on every frustrated tap.
                        const signature = `${reason}|${tab}|${hitTest}|${blockers}|${overlays}`;
                        const now = Date.now();
                        const seen = lastRecorded.get(signature);
                        if (seen !== undefined && now - seen < DEDUPE_MS) return;
                        lastRecorded.set(signature, now);

                        void clientErrorLog.record({
                            operation: "tab-nav-stuck",
                            code: reason,
                            message: [
                                `tapped=${tab} (${href})`,
                                `url=${from} -> ${to}`,
                                `ionicSelectedTab=${describeSelectedTab()}`,
                                `pages=${describePages()}`,
                                `hitTestAtButton=${hitTest}`,
                                `overlays=${overlays}`,
                                `shell=${blockers}`,
                            ].join(" | "),
                        });
                    } catch {
                        // A diagnostic must never be the thing that breaks the app.
                    }
                }, SETTLE_MS);
            } catch {
                // As above.
            }
        };

        document.addEventListener("click", handleClick, true);
        return () => document.removeEventListener("click", handleClick, true);
    }, []);
};

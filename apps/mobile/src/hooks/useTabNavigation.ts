import { NavContext } from "@ionic/react";
import { useCallback, useContext } from "react";
import { APP_TABS, type AppTabName } from "./appTabs";

/**
 * Navigate to another bottom-tab from inside a tab page.
 *
 * Use this instead of `history.push("/recipes")` or `useIonRouter().push(...)`. A plain router
 * push does move the URL, but it bypasses `IonTabs`' bookkeeping: Ionic tags the new route
 * entry with whatever tab was current at the time, so the destination's route lands in the
 * *departing* tab's history stack (`LocationHistory.tabHistory`). The tab bar's notion of
 * per-tab history then disagrees with reality, which leaves the affected tab buttons resetting
 * to the wrong route — or doing nothing at all.
 *
 * `NavContext.changeTab` is the same entry point `IonTabBar` uses when you tap a tab button, so
 * going through it keeps the tab stacks consistent.
 */
export const useTabNavigation = () => {
    const { changeTab } = useContext(NavContext);

    return useCallback(
        (tab: AppTabName) => {
            const target = APP_TABS.find((t) => t.tab === tab);
            if (!target) return;
            changeTab(target.tab, target.href);
        },
        [changeTab]
    );
};

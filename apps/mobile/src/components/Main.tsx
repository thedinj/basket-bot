import { LLMModalProvider } from "@/llm/shared";
import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from "@ionic/react";
import { cartOutline } from "ionicons/icons";
import { useEffect, useRef } from "react";
import { Route } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { usePreloadCoreData } from "../db/hooks";
import ShoppingList from "../pages/ShoppingList";
import { AppHeaderProvider } from "./layout/AppHeaderProvider";
import { AppMenu } from "./layout/AppMenu";
import NetworkStatusBanner from "./shared/NetworkStatusBanner";
import ShieldProvider from "./shield/ShieldProvider";

interface AppTab {
    tab: string;
    href: string;
    icon: string;
    label: string;
}

/**
 * Main app component with authenticated routes and tabs
 * Only rendered when user is authenticated
 */
const Main: React.FC = () => {
    const { isAuthReady } = useAuth();
    const { prefetchCoreData } = usePreloadCoreData();
    const hasPrefetched = useRef(false);

    // Preload static/core data on app initialization
    // Wait for auth to be fully ready (tokens validated and refreshed if needed)
    useEffect(() => {
        if (isAuthReady && !hasPrefetched.current) {
            hasPrefetched.current = true;
            prefetchCoreData().catch((error: unknown) => {
                // Prefetch errors are non-critical - data will be fetched when actually needed
                console.warn("[Main] Prefetch failed, will fetch on demand:", error);
            });
        }
    }, [isAuthReady, prefetchCoreData]);

    const tabs: AppTab[] = [
        {
            tab: "shoppinglist",
            href: "/shoppinglist",
            icon: cartOutline,
            label: "Shopping List",
        },
    ];

    return (
        <ShieldProvider>
            <LLMModalProvider>
                <AppHeaderProvider>
                    <AppMenu />
                    <NetworkStatusBanner />
                    <IonTabs>
                        <IonRouterOutlet id="main-content" animated={false}>
                            {/* REMEMBER: Most specific routes first */}
                            <Route exact path="/shoppinglist" component={ShoppingList} />
                        </IonRouterOutlet>

                        {tabs.length > 1 && (
                            <IonTabBar slot="bottom">
                                {tabs.map(({ tab, href, icon, label }) => (
                                    <IonTabButton key={tab} tab={tab} href={href}>
                                        <IonIcon aria-hidden="true" icon={icon} />
                                        <IonLabel>{label}</IonLabel>
                                    </IonTabButton>
                                ))}
                            </IonTabBar>
                        )}
                    </IonTabs>
                </AppHeaderProvider>
            </LLMModalProvider>
        </ShieldProvider>
    );
};

export default Main;

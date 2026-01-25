import { LLMModalProvider } from "@/llm/shared";
import {
    IonBadge,
    IonIcon,
    IonLabel,
    IonRouterOutlet,
    IonTabBar,
    IonTabButton,
    IonTabs,
} from "@ionic/react";
import { cartOutline, storefrontOutline } from "ionicons/icons";
import { useEffect, useRef } from "react";
import { Route } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useNotificationCounts, usePreloadCoreData } from "../db/hooks";
import ShoppingList from "../pages/ShoppingList";
import StoreAislesPage from "../pages/StoreAislesPage";
import StoreDetail from "../pages/StoreDetail";
import StoreInvitations from "../pages/StoreInvitations";
import StoreItemsPage from "../pages/StoreItemsPage";
import StoresList from "../pages/StoresList";
import { AppHeaderProvider } from "./layout/AppHeaderProvider";
import { AppMenu } from "./layout/AppMenu";
import Settings from "./settings/Settings";
import NetworkStatusBanner from "./shared/NetworkStatusBanner";
import ShieldProvider from "./shield/ShieldProvider";

/**
 * Main app component with authenticated routes and tabs
 * Only rendered when user is authenticated
 */
const Main: React.FC = () => {
    const { isAuthReady } = useAuth();
    const { data: notificationCounts } = useNotificationCounts();
    const { prefetchCoreData } = usePreloadCoreData();
    const hasPrefetched = useRef(false);

    // Preload static/core data on app initialization
    // Wait for auth to be fully ready (tokens validated and refreshed if needed)
    useEffect(() => {
        if (isAuthReady && !hasPrefetched.current) {
            hasPrefetched.current = true;
            prefetchCoreData().catch((error) => {
                // Prefetch errors are non-critical - data will be fetched when actually needed
                console.warn("[Main] Prefetch failed, will fetch on demand:", error);
            });
        }
    }, [isAuthReady, prefetchCoreData]);

    return (
        <ShieldProvider>
            <LLMModalProvider>
                <AppHeaderProvider>
                    <AppMenu />
                    <Settings />
                    <NetworkStatusBanner />
                    <IonTabs>
                        <IonRouterOutlet id="main-content">
                            <Route exact path="/shoppinglist" component={ShoppingList} />
                            <Route exact path="/stores" component={StoresList} />
                            <Route exact path="/invitations" component={StoreInvitations} />
                            <Route exact path="/stores/:id/items" component={StoreItemsPage} />
                            <Route exact path="/stores/:id/aisles" component={StoreAislesPage} />
                            <Route exact path="/stores/:id" component={StoreDetail} />
                        </IonRouterOutlet>
                        <IonTabBar slot="bottom">
                            <IonTabButton tab="shoppinglist" href="/shoppinglist">
                                <IonIcon aria-hidden="true" icon={cartOutline} />
                                <IonLabel>Shopping List</IonLabel>
                            </IonTabButton>
                            <IonTabButton tab="stores" href="/stores">
                                <IonIcon aria-hidden="true" icon={storefrontOutline} />
                                <IonLabel>Stores</IonLabel>
                                {notificationCounts && notificationCounts.storeInvitations > 0 && (
                                    <IonBadge color="danger">
                                        {notificationCounts.storeInvitations}
                                    </IonBadge>
                                )}
                            </IonTabButton>
                        </IonTabBar>
                    </IonTabs>
                </AppHeaderProvider>
            </LLMModalProvider>
        </ShieldProvider>
    );
};

export default Main;

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
import { Route } from "react-router-dom";
import { useNotificationCounts } from "../db/hooks";
import ShoppingList from "../pages/ShoppingList";
import StoreAislesPage from "../pages/StoreAislesPage";
import StoreDetail from "../pages/StoreDetail";
import StoreInvitations from "../pages/StoreInvitations";
import StoreItemsPage from "../pages/StoreItemsPage";
import StoresList from "../pages/StoresList";
import { AppHeaderProvider } from "./layout/AppHeaderProvider";
import { AppMenu } from "./layout/AppMenu";
import Settings from "./settings/Settings";

/**
 * Main app component with authenticated routes and tabs
 * Only rendered when user is authenticated
 */
const Main: React.FC = () => {
    const { data: notificationCounts } = useNotificationCounts();

    return (
        <LLMModalProvider>
            <AppHeaderProvider>
                <AppMenu />
                <Settings />
                <IonTabs>
                    <IonRouterOutlet id="main-content">
                        <Route exact path="/shoppinglist">
                            <ShoppingList />
                        </Route>
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
    );
};

export default Main;

import { LLMModalProvider } from "@/llm/shared";
import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from "@ionic/react";
import { cartOutline, storefrontOutline } from "ionicons/icons";
import { Redirect, Route } from "react-router-dom";
import ShoppingList from "../pages/ShoppingList";
import StoreAislesPage from "../pages/StoreAislesPage";
import StoreDetail from "../pages/StoreDetail";
import StoreItemsPage from "../pages/StoreItemsPage";
import StoresList from "../pages/StoresList";
import { AppHeaderProvider } from "./layout/AppHeaderProvider";
import { AppMenu } from "./layout/AppMenu";
import Settings from "./settings/Settings";

/**
 * Main app component with authenticated routes and tabs
 * Only rendered when user is authenticated
 */
const Main: React.FC = () => (
    <LLMModalProvider>
        <AppHeaderProvider>
            <AppMenu />
            <Settings />
            <IonTabs>
                <IonRouterOutlet id="main-content">
                    <Route exact path="/stores">
                        <StoresList />
                    </Route>
                    <Route exact path="/stores/:id">
                        <StoreDetail />
                    </Route>
                    <Route exact path="/stores/:id/items">
                        <StoreItemsPage />
                    </Route>
                    <Route exact path="/stores/:id/aisles">
                        <StoreAislesPage />
                    </Route>
                    <Route exact path="/shoppinglist">
                        <ShoppingList />
                    </Route>
                    <Route exact path="/">
                        <Redirect to="/shoppinglist" />
                    </Route>
                </IonRouterOutlet>
                <IonTabBar slot="bottom">
                    <IonTabButton tab="shoppinglist" href="/shoppinglist">
                        <IonIcon aria-hidden="true" icon={cartOutline} />
                        <IonLabel>Shopping List</IonLabel>
                    </IonTabButton>
                    <IonTabButton tab="stores" href="/stores">
                        <IonIcon aria-hidden="true" icon={storefrontOutline} />
                        <IonLabel>Stores</IonLabel>
                    </IonTabButton>
                </IonTabBar>
            </IonTabs>
        </AppHeaderProvider>
    </LLMModalProvider>
);

export default Main;

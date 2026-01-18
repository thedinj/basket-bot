import { IonApp, IonRouterOutlet, setupIonicReact } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { Suspense } from "react";
import { Redirect, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { useAuth } from "./auth/useAuth";
import AppErrorBoundary from "./components/AppErrorBoundary";
import Auth from "./components/Auth";
import LoadingFallback from "./components/LoadingFallback";
import Main from "./components/Main";
import { DatabaseProvider } from "./db/DatabaseContext";

/* Core CSS required for Ionic components to work properly */
import "@ionic/react/css/core.css";

/* Basic CSS for apps built with Ionic */
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";

/* Optional CSS utils that can be commented out */
import "@ionic/react/css/display.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/padding.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import "@ionic/react/css/palettes/dark.system.css";

/* Theme variables */
import "./theme/variables.scss";

setupIonicReact();

/**
 * Protected route wrapper - redirects to login if not authenticated
 */
const ProtectedRoute: React.FC<{
    component: React.ComponentType;
    path: string;
    exact?: boolean;
}> = ({ component: Component, ...rest }) => {
    const { isAuthenticated } = useAuth();

    return (
        <Route
            {...rest}
            render={() => (isAuthenticated ? <Component /> : <Redirect to="/login" />)}
        />
    );
};

/**
 * Auth route wrapper - redirects to shopping list if already authenticated
 */
const AuthRoute: React.FC<{ component: React.ComponentType; path: string; exact?: boolean }> = ({
    component: Component,
    ...rest
}) => {
    const { isAuthenticated } = useAuth();

    return (
        <Route
            {...rest}
            render={() => (isAuthenticated ? <Redirect to="/shoppinglist" /> : <Component />)}
        />
    );
};

/**
 * App routing structure
 */
const AppRoutes: React.FC = () => {
    const { isAuthenticated, isInitializing } = useAuth();

    // Wait for auth state to be determined before rendering routes
    if (isInitializing) {
        return <LoadingFallback />;
    }

    return (
        <IonRouterOutlet>
            {/* Default redirect */}
            <Route
                exact
                path="/"
                render={() => <Redirect to={isAuthenticated ? "/shoppinglist" : "/login"} />}
            />

            {/* Auth routes - redirect to /shoppinglist if authenticated */}
            <AuthRoute path="/login" component={Auth} />
            <AuthRoute path="/register" component={Auth} />

            {/* Protected routes - redirect to /login if not authenticated */}
            <ProtectedRoute path="/shoppinglist" component={Main} />
            <ProtectedRoute path="/stores" component={Main} />
            <ProtectedRoute path="/invitations" component={Main} />

            {/* Catch-all - redirect unknown routes */}
            <Route render={() => <Redirect to={isAuthenticated ? "/shoppinglist" : "/login"} />} />
        </IonRouterOutlet>
    );
};

const App: React.FC = () => {
    return (
        <IonApp>
            <IonReactRouter>
                <AppErrorBoundary>
                    <Suspense fallback={<LoadingFallback />}>
                        <DatabaseProvider>
                            <AuthProvider>
                                <AppRoutes />
                            </AuthProvider>
                        </DatabaseProvider>
                    </Suspense>
                </AppErrorBoundary>
            </IonReactRouter>
        </IonApp>
    );
};

export default App;

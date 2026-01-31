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
 * Protected Route - renders Main if authenticated, else redirects to login
 */
const ProtectedContent: React.FC = () => {
    const { isAuthenticated } = useAuth();
    return isAuthenticated ? <Main /> : <Redirect to="/login" />;
};

/**
 * Auth Route - renders Auth if not authenticated, else redirects to shopping list
 */
const AuthContent: React.FC = () => {
    const { isAuthenticated } = useAuth();
    return isAuthenticated ? <Redirect to="/shoppinglist" /> : <Auth />;
};

/**
 * Root Redirect - redirects to shopping list if authenticated, else login
 */
const RootRedirect: React.FC = () => {
    const { isAuthenticated } = useAuth();
    return <Redirect to={isAuthenticated ? "/shoppinglist" : "/login"} />;
};

/**
 * App routing structure
 */
const AppRoutes: React.FC = () => {
    const { isInitializing } = useAuth();

    // Wait for auth state to be determined before rendering routes
    if (isInitializing) {
        return <LoadingFallback />;
    }

    return (
        <IonRouterOutlet>
            {/* Default redirect */}
            <Route exact path="/" component={RootRedirect} />

            {/* Auth routes - redirect to /shoppinglist if authenticated */}
            <Route exact path="/login" component={AuthContent} />
            <Route exact path="/register" component={AuthContent} />

            {/* Protected routes - all other routes render Main (if authenticated) or redirect to login */}
            <Route component={ProtectedContent} />
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

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
import ServerRecoveryEffect from "./components/ServerRecoveryEffect";
import ServerUnreachable from "./components/ServerUnreachable";
import NetworkStatusBanner from "./components/shared/NetworkStatusBanner";
import ThemeApplier from "./components/ThemeApplier";
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
import "@ionic/react/css/palettes/dark.class.css";
/* import '@ionic/react/css/palettes/dark.system.css'; */

/* Bundled fonts (the "Highway" type system) — self-hosted so they work offline in the APK */
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/400-italic.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
/* Aisle names: Overpass, a Highway Gothic (US road sign) revival */
import "@fontsource/overpass/800.css";
/* Monochrome emoji for aisle plates: one weight; unicode-range chunks load only as used */
import "@fontsource/noto-emoji/500.css";

/* Theme variables */
import "./theme/variables.scss";
import "./theme/typography.scss";
import "./theme/forms.scss";
import "./theme/patterns.scss";

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
    const { isInitializing, isAuthenticated, hasStoredTokens, isServerUnreachable, logout } =
        useAuth();

    // Wait for auth state to be determined before rendering routes
    if (isInitializing) {
        return <LoadingFallback />;
    }

    // Stored credentials we couldn't verify because the server is down. Falling through here
    // would redirect to /login, which cannot work without that same server. Rendered in place
    // of the outlet rather than as a route: it is not an IonPage, and a non-page inside
    // IonRouterOutlet leaves the outlet stuck (see the tab/Suspense note in CLAUDE.md).
    if (!isAuthenticated && hasStoredTokens && isServerUnreachable) {
        return <ServerUnreachable onSignOut={logout} />;
    }

    return (
        <>
            {/* Outside the router outlet on purpose: Ionic parks an inline overlay (the
                banner's queue-review modal) in a <template> and presents it through a
                delegate, and that delegate cannot present from inside IonRouterOutlet — the
                modal opens in state but stays inert in the template, which is why tapping the
                banner appeared to do nothing. */}
            {isAuthenticated && <NetworkStatusBanner />}
            <IonRouterOutlet>
                {/* Default redirect */}
                <Route exact path="/" component={RootRedirect} />

                {/* Auth routes - redirect to /shoppinglist if authenticated */}
                <Route exact path="/login" component={AuthContent} />
                <Route exact path="/register" component={AuthContent} />

                {/* Protected routes - all other routes render Main (if authenticated) or redirect to login */}
                <Route component={ProtectedContent} />
            </IonRouterOutlet>
        </>
    );
};

const App: React.FC = () => {
    return (
        <IonApp>
            <IonReactRouter>
                <AppErrorBoundary>
                    <Suspense fallback={<LoadingFallback />}>
                        <DatabaseProvider>
                            <ThemeApplier />
                            <AuthProvider>
                                {/* Inside AuthProvider: replaying the queue needs to know
                                    whether anyone is signed in. */}
                                <ServerRecoveryEffect />
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

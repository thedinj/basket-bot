import { IonApp, setupIonicReact } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { Suspense } from "react";
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
 * App content that handles auth routing
 */
const AppContent: React.FC = () => {
    const { isAuthenticated } = useAuth();

    return isAuthenticated ? <Main /> : <Auth />;
};

const App: React.FC = () => {
    return (
        <IonApp>
            <IonReactRouter>
                <AppErrorBoundary>
                    <Suspense fallback={<LoadingFallback />}>
                        <DatabaseProvider>
                            <AuthProvider>
                                <AppContent />
                            </AuthProvider>
                        </DatabaseProvider>
                    </Suspense>
                </AppErrorBoundary>
            </IonReactRouter>
        </IonApp>
    );
};

export default App;

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import { IonRouterOutlet } from "@ionic/react";
import { Route } from "react-router-dom";

/**
 * Auth component with unauthenticated routes
 * Only rendered when user is not authenticated
 */
const Auth: React.FC = () => (
    <IonRouterOutlet id="auth">
        <Route exact path="/login">
            <Login />
        </Route>
        <Route exact path="/register">
            <Register />
        </Route>
    </IonRouterOutlet>
);

export default Auth;

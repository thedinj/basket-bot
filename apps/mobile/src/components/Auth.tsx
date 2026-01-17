import Login from "@/pages/Login";
import Register from "@/pages/Register";
import { IonRouterOutlet } from "@ionic/react";
import { Redirect, Route } from "react-router-dom";

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
        <Route exact path="/">
            <Redirect to="/login" />
        </Route>
    </IonRouterOutlet>
);

export default Auth;

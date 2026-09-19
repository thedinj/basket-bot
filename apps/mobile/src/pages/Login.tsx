import pluralize from "pluralize";
import { zodResolver } from "@hookform/resolvers/zod";
import { IonButton, IonContent, IonPage } from "@ionic/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "../auth/useAuth";
import { PasswordField } from "../components/form/PasswordField";
import { TextField } from "../components/form/TextField";
import { ApiError, RateLimitErrorDetails } from "../lib/api/client";
import "./AuthPages.scss";

const loginSchema = z.object({
    email: z.string().trim().email("Please enter a valid email"),
    password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const Login: React.FC = () => {
    const { login } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { control, handleSubmit } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    const onSubmit = async (data: LoginFormData) => {
        setError(null);
        setIsSubmitting(true);

        try {
            await login(data.email, data.password);
            // Navigation will be handled by AuthRoute in App.tsx
        } catch (err: unknown) {
            if (err instanceof ApiError && err.isNetworkError) {
                setError(
                    err.code === "TIMEOUT"
                        ? "Request timed out. Please check your connection and try again."
                        : "Network error. Please check your connection and try again."
                );
            } else if (err instanceof ApiError && err.status && err.status >= 500) {
                // A server that failed to answer never judged the credentials — saying they
                // were wrong sends the user to reset a password that is perfectly fine.
                setError("The server is not answering. Your credentials were never assessed.");
            } else if (err instanceof ApiError && err.status === 429) {
                const retryAfter = (err.details as RateLimitErrorDetails | undefined)?.retryAfter;
                if (retryAfter) {
                    const minutes = Math.ceil(retryAfter / 60);
                    setError(
                        `Too many login attempts. Please try again in ${minutes} ${pluralize("minute", minutes)}.`
                    );
                } else {
                    setError("Too many login attempts. Please try again later.");
                }
            } else {
                setError("Invalid email or password");
            }
            console.error("Login error:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <IonPage>
            <IonContent className="auth-page-content">
                <div className="auth-page">
                    <section className="auth-panel" aria-labelledby="login-title">
                        <p className="auth-panel__overline">Basket Bot</p>
                        <h1 id="login-title" className="auth-panel__title">
                            Sign In
                        </h1>

                        <form className="editor-form" onSubmit={handleSubmit(onSubmit)} noValidate>
                            <TextField
                                name="email"
                                control={control}
                                label="Email"
                                type="email"
                                placeholder="your@email.com"
                                autocomplete="username"
                                disabled={isSubmitting}
                            />

                            <PasswordField
                                name="password"
                                control={control}
                                label="Password"
                                placeholder="Enter your password"
                                autocomplete="current-password"
                                disabled={isSubmitting}
                            />

                            {error && (
                                <p className="form-field__error" role="alert">
                                    {error}
                                </p>
                            )}

                            <IonButton
                                className="editor-form__submit"
                                expand="block"
                                type="submit"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "Signing in..." : "Sign In"}
                            </IonButton>
                        </form>

                        <IonButton
                            className="auth-panel__switch"
                            expand="block"
                            fill="clear"
                            routerLink="/register"
                            disabled={isSubmitting}
                        >
                            Don't have an account?
                            <span className="auth-panel__switch-action">Sign up</span>
                        </IonButton>
                    </section>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default Login;

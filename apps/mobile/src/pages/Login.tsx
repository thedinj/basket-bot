import { useRenderStormDetector } from "@/hooks/useRenderStormDetector";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonPage,
    IonText,
} from "@ionic/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "../auth/useAuth";
import { FormPasswordInput } from "../components/form/FormPasswordInput";
import { FormTextInput } from "../components/form/FormTextInput";
import "./AuthPages.scss";

const loginSchema = z.object({
    email: z.string().email("Please enter a valid email"),
    password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const Login: React.FC = () => {
    useRenderStormDetector("Login");
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            // Handle rate limit (429)
            if (err?.response?.status === 429) {
                const retryAfter = err.response.data?.details?.retryAfter;
                if (retryAfter) {
                    const minutes = Math.ceil(retryAfter / 60);
                    setError(
                        `Too many login attempts. Please try again in ${minutes} minute${minutes !== 1 ? "s" : ""}.`
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
            <IonContent className="ion-padding auth-page-content">
                <div className="auth-card-container">
                    <IonCard className="auth-card">
                        <IonCardHeader>
                            <IonCardTitle>Sign In</IonCardTitle>
                        </IonCardHeader>
                        <IonCardContent>
                            <form onSubmit={handleSubmit(onSubmit)}>
                                <FormTextInput
                                    name="email"
                                    control={control}
                                    label="Email"
                                    type="email"
                                    placeholder="your@email.com"
                                    disabled={isSubmitting}
                                />

                                <FormPasswordInput
                                    name="password"
                                    control={control}
                                    label="Password"
                                    placeholder="Enter your password"
                                    disabled={isSubmitting}
                                />

                                {error && (
                                    <IonText color="danger">
                                        <p style={{ marginTop: "1rem" }}>{error}</p>
                                    </IonText>
                                )}

                                <IonButton
                                    expand="block"
                                    type="submit"
                                    disabled={isSubmitting}
                                    style={{ marginTop: "1.5rem" }}
                                >
                                    {isSubmitting ? "Signing in..." : "Sign In"}
                                </IonButton>

                                <IonButton
                                    expand="block"
                                    fill="clear"
                                    routerLink="/register"
                                    disabled={isSubmitting}
                                >
                                    Don't have an account? Sign up
                                </IonButton>
                            </form>
                        </IonCardContent>
                    </IonCard>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default Login;

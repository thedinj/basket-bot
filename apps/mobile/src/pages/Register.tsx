import { MIN_PASSWORD_LENGTH } from "@basket-bot/core";
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
import { useHistory } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../auth/useAuth";
import { FormPasswordInput } from "../components/form/FormPasswordInput";
import { FormTextInput } from "../components/form/FormTextInput";

const registerSchema = z
    .object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Please enter a valid email"),
        password: z
            .string()
            .min(
                MIN_PASSWORD_LENGTH,
                `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
            ),
        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
    });

type RegisterFormData = z.infer<typeof registerSchema>;

const Register: React.FC = () => {
    const history = useHistory();
    const { register: registerUser } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { control, handleSubmit } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
            confirmPassword: "",
        },
    });

    const onSubmit = async (data: RegisterFormData) => {
        setError(null);
        setIsSubmitting(true);

        try {
            await registerUser(data.email, data.name, data.password);
            // Auto-login happens in registerUser, App.tsx will handle navigation
        } catch (err: any) {
            // Handle rate limit (429)
            if (err?.response?.status === 429) {
                const retryAfter = err.response.data?.details?.retryAfter;
                if (retryAfter) {
                    const minutes = Math.ceil(retryAfter / 60);
                    setError(
                        `Too many registration attempts. Please try again in ${minutes} minute${minutes !== 1 ? "s" : ""}.`
                    );
                } else {
                    setError("Too many registration attempts. Please try again later.");
                }
            } else if (err?.response?.status === 409) {
                setError("An account with this email already exists");
            } else {
                setError("Registration failed. Please try again.");
            }
            console.error("Registration error:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <IonPage>
            <IonContent className="ion-padding">
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: "100%",
                    }}
                >
                    <IonCard style={{ maxWidth: "400px", width: "100%" }}>
                        <IonCardHeader>
                            <IonCardTitle>Create Account</IonCardTitle>
                        </IonCardHeader>
                        <IonCardContent>
                            <form onSubmit={handleSubmit(onSubmit)}>
                                <FormTextInput
                                    name="name"
                                    control={control}
                                    label="Name"
                                    placeholder="Your full name"
                                    disabled={isSubmitting}
                                />

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
                                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                                    helperText={`Must be at least ${MIN_PASSWORD_LENGTH} characters`}
                                    disabled={isSubmitting}
                                />

                                <FormPasswordInput
                                    name="confirmPassword"
                                    control={control}
                                    label="Confirm Password"
                                    placeholder="Re-enter your password"
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
                                    {isSubmitting ? "Creating account..." : "Sign Up"}
                                </IonButton>

                                <IonButton
                                    expand="block"
                                    fill="clear"
                                    onClick={() => history.push("/login")}
                                    disabled={isSubmitting}
                                >
                                    Already have an account? Sign in
                                </IonButton>
                            </form>
                        </IonCardContent>
                    </IonCard>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default Register;

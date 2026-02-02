import { useRenderStormDetector } from "@/hooks/useRenderStormDetector";
import { MIN_PASSWORD_LENGTH, passwordSchema } from "@basket-bot/core";
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
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "../auth/useAuth";
import { FormPasswordInput } from "../components/form/FormPasswordInput";
import { FormTextInput } from "../components/form/FormTextInput";
import { apiClient } from "../lib/api/client";
import "./AuthPages.scss";

const registerSchema = z
    .object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Please enter a valid email"),
        password: passwordSchema,
        confirmPassword: z.string(),
        invitationCode: z.string().optional(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
    });

type RegisterFormData = z.infer<typeof registerSchema>;

const Register: React.FC = () => {
    useRenderStormDetector("Register");
    const { register: registerUser } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Check if invitation code is required
    const { data: invitationRequired } = useQuery({
        queryKey: ["auth", "invitation-required"],
        queryFn: async () => {
            const response = await apiClient.get<{ required: boolean }>(
                "/api/auth/invitation-required"
            );
            return response.required;
        },
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    const { control, handleSubmit } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
            confirmPassword: "",
            invitationCode: "",
        },
    });

    const onSubmit = async (data: RegisterFormData) => {
        setError(null);
        setIsSubmitting(true);

        try {
            await registerUser(
                data.email,
                data.name,
                data.password,
                data.invitationCode || undefined
            );
            // Auto-login happens in registerUser, App.tsx will handle navigation
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            } else if (err?.response?.status === 400) {
                const code = err?.response?.data?.code;
                if (code === "INVITATION_CODE_REQUIRED") {
                    setError("Registration requires an invitation code");
                } else if (code === "INVALID_INVITATION_CODE") {
                    setError("Invalid invitation code");
                } else {
                    setError("Registration failed. Please try again.");
                }
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
            <IonContent className="ion-padding auth-page-content">
                <div className="auth-card-container">
                    <IonCard className="auth-card">
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

                                {invitationRequired && (
                                    <FormTextInput
                                        name="invitationCode"
                                        control={control}
                                        label="Invitation Code"
                                        placeholder="Enter your invitation code"
                                        disabled={isSubmitting}
                                    />
                                )}

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
                                    routerLink="/login"
                                    disabled={isSubmitting}
                                >
                                    Already have an account?
                                    <br />
                                    Sign in
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

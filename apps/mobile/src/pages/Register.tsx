import { queryKeys } from "@/db/queryKeys";
import pluralize from "pluralize";
import { MIN_PASSWORD_LENGTH, passwordSchema } from "@basket-bot/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { IonButton, IonContent, IonPage } from "@ionic/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "../auth/useAuth";
import { PasswordField } from "../components/form/PasswordField";
import { TextField } from "../components/form/TextField";
import { apiClient, ApiError, RateLimitErrorDetails } from "../lib/api/client";
import "./AuthPages.scss";

// Text fields are trimmed here, on submit, rather than on every keystroke: trimming as you
// type swallowed the space between a first and last name.
const registerSchema = z
    .object({
        name: z.string().trim().min(1, "Name is required"),
        email: z.string().trim().email("Please enter a valid email"),
        password: passwordSchema,
        confirmPassword: z.string(),
        invitationCode: z.string().trim().optional(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
    });

type RegisterFormData = z.infer<typeof registerSchema>;

const Register: React.FC = () => {
    const { register: registerUser } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Check if invitation code is required
    const { data: invitationRequired } = useQuery({
        queryKey: queryKeys.auth.invitationRequired(),
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
        } catch (err: unknown) {
            if (err instanceof ApiError && err.isNetworkError) {
                setError(
                    err.code === "TIMEOUT"
                        ? "Request timed out. Please check your connection and try again."
                        : "Network error. Please check your connection and try again."
                );
            } else if (err instanceof ApiError && err.status && err.status >= 500) {
                setError("The server is not answering. Nothing was registered.");
            } else if (err instanceof ApiError && err.status === 429) {
                const retryAfter = (err.details as RateLimitErrorDetails | undefined)?.retryAfter;
                if (retryAfter) {
                    const minutes = Math.ceil(retryAfter / 60);
                    setError(
                        `Too many registration attempts. Please try again in ${minutes} ${pluralize("minute", minutes)}.`
                    );
                } else {
                    setError("Too many registration attempts. Please try again later.");
                }
            } else if (err instanceof ApiError && err.status === 409) {
                setError("An account with this email already exists");
            } else if (err instanceof ApiError && err.status === 400) {
                if (err.code === "INVITATION_CODE_REQUIRED") {
                    setError("Registration requires an invitation code");
                } else if (err.code === "INVALID_INVITATION_CODE") {
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
            <IonContent className="auth-page-content">
                <div className="auth-page">
                    <section className="auth-panel" aria-labelledby="register-title">
                        <p className="auth-panel__overline">Basket Bot</p>
                        <h1 id="register-title" className="auth-panel__title">
                            Create Account
                        </h1>

                        <form className="editor-form" onSubmit={handleSubmit(onSubmit)} noValidate>
                            <TextField
                                name="name"
                                control={control}
                                label="Name"
                                placeholder="Your full name"
                                autocomplete="name"
                                autocapitalize="words"
                                disabled={isSubmitting}
                            />

                            <TextField
                                name="email"
                                control={control}
                                label="Email"
                                type="email"
                                placeholder="your@email.com"
                                autocomplete="email"
                                disabled={isSubmitting}
                            />

                            <PasswordField
                                name="password"
                                control={control}
                                label="Password"
                                placeholder="Choose a password"
                                hint={`Must be at least ${MIN_PASSWORD_LENGTH} characters.`}
                                autocomplete="new-password"
                                disabled={isSubmitting}
                            />

                            <PasswordField
                                name="confirmPassword"
                                control={control}
                                label="Confirm Password"
                                placeholder="Re-enter your password"
                                autocomplete="new-password"
                                disabled={isSubmitting}
                            />

                            {invitationRequired && (
                                <TextField
                                    name="invitationCode"
                                    control={control}
                                    label="Invitation Code"
                                    placeholder="Enter your invitation code"
                                    autocomplete="off"
                                    disabled={isSubmitting}
                                />
                            )}

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
                                {isSubmitting ? "Creating account..." : "Sign Up"}
                            </IonButton>
                        </form>

                        <IonButton
                            className="auth-panel__switch"
                            expand="block"
                            fill="clear"
                            routerLink="/login"
                            disabled={isSubmitting}
                        >
                            Already have an account?
                            <span className="auth-panel__switch-action">Sign in</span>
                        </IonButton>
                    </section>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default Register;

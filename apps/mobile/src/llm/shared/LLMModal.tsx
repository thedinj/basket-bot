import { KeepAwake } from "@capacitor-community/keep-awake";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import {
    IonButton,
    IonButtons,
    IonChip,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonModal,
    IonText,
    IonTextarea,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { attach, camera, close } from "ionicons/icons";
import React, { use, useRef, useState } from "react";
import { useShield } from "../../components/shield/useShield";
import { useSecureApiKey } from "../../hooks/useSecureStorage";
import { useToast } from "../../hooks/useToast";
import { OpenAIClient } from "./openaiClient";
import type { LLMAttachment } from "./types";
import { useLLMModalContext } from "./useLLMModalContext";

const checkCameraAllowedAsync = Capacitor.isNativePlatform()
    ? Camera.requestPermissions({ permissions: ["camera"] }).then(() => true)
    : Promise.resolve(false);

/**
 * Modal for running LLM API calls with file attachments
 */
export const LLMModal: React.FC = () => {
    const { isOpen, config, closeModal, response, setResponse } = useLLMModalContext();
    const { showError } = useToast();
    const apiKeyValue = useSecureApiKey();
    const { raiseShield, lowerShield } = useShield();
    const [attachments, setAttachments] = useState<LLMAttachment[]>([]);
    const [userText, setUserText] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isAllowCamera = use(checkCameraAllowedAsync);

    const handleClose = () => {
        if (config?.onCancel) {
            config.onCancel();
        }

        // Reset state
        setAttachments([]);
        setUserText("");
        closeModal();
    };

    const handleAccept = () => {
        if (!response || !config) return;

        config.onAccept(response);
        setAttachments([]);
        setUserText("");
        closeModal();
    };

    const handleCapture = async () => {
        if (!config || !isAllowCamera) return;

        try {
            // Dynamically import Capacitor Camera for native platforms
            try {
                const image = await Camera.getPhoto({
                    quality: 90,
                    allowEditing: false,
                    resultType: CameraResultType.Base64,
                    source: CameraSource.Photos,
                });

                if (image.base64String) {
                    const attachment: LLMAttachment = {
                        name: `image_${Date.now()}.${image.format}`,
                        data: image.base64String,
                        mimeType: `image/${image.format}`,
                    };
                    setAttachments((prev) => [...prev, attachment]);
                }
            } catch {
                // The user might have just cancelled the photo taking, so don't show an error in that case
            }
        } catch (error: unknown) {
            if (error instanceof Error && error.message !== "User cancelled photos app") {
                showError(`Failed to add attachment: ${error.message}`);
            }
        }
    };

    const handleAddAttachment = async () => {
        if (!config) return;
        fileInputRef.current?.click();
    };

    const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const newAttachments: LLMAttachment[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            // Convert to base64
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                    const result = reader.result as string;
                    // Remove data URL prefix
                    const base64 = result.split(",")[1];
                    resolve(base64);
                };
                reader.onerror = reject;
            });

            reader.readAsDataURL(file);

            try {
                const base64Data = await base64Promise;
                newAttachments.push({
                    name: file.name,
                    data: base64Data,
                    mimeType: file.type,
                });
            } catch {
                showError(`Failed to read file: ${file.name}`);
            }
        }

        setAttachments((prev) => [...prev, ...newAttachments]);

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleRemoveAttachment = (index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    const handleRunLLM = async () => {
        if (!config) return;

        if (!apiKeyValue) {
            showError("OpenAI API key not configured. Please add it in Settings.");
            return;
        }

        // Validate at least one input type is provided
        const trimmedText = userText.trim();
        if (attachments.length === 0 && !trimmedText) {
            showError("Please provide at least one input: text or attachment.");
            return;
        }

        const shieldId = `llm-modal-${config.title || "default"}`;
        raiseShield(shieldId, config.shieldMessage || "Processing with AI...");
        setResponse(null);

        try {
            // Keep screen on during API call to prevent network interruption
            if (Capacitor.isNativePlatform()) {
                await KeepAwake.keepAwake();
            }

            const client = new OpenAIClient(apiKeyValue);
            const llmResponse = await client.call({
                prompt: config.prompt,
                model: config.model || "gpt-4o-mini",
                attachments: attachments.length > 0 ? attachments : undefined,
                userText: trimmedText || undefined,
            });

            // Validate response if validator is provided
            if (config.validateResponse) {
                try {
                    const isValid = config.validateResponse(llmResponse);
                    if (!isValid) {
                        throw new Error("Response validation failed");
                    }
                } catch (validationError) {
                    showError(
                        validationError instanceof Error
                            ? `Invalid response: ${validationError.message}`
                            : "Failed to validate LLM response. The output was not in the expected format."
                    );
                    return;
                }
            }

            setResponse(llmResponse);
        } catch (error) {
            showError(
                error instanceof Error
                    ? `LLM API error: ${error.message}`
                    : "Failed to call LLM API"
            );
        } finally {
            // Allow screen to sleep again
            if (Capacitor.isNativePlatform()) {
                await KeepAwake.allowSleep();
            }
            lowerShield(shieldId);
        }
    };

    if (!config) return null;

    return (
        <>
            <IonModal isOpen={isOpen} onDidDismiss={handleClose}>
                <IonHeader>
                    <IonToolbar>
                        <IonTitle>{config.title || "LLM Assistant"}</IonTitle>
                        <IonButtons slot="end">
                            <IonButton onClick={handleClose}>
                                <IonIcon icon={close} />
                            </IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>

                <IonContent className="ion-padding">
                    {/* API Key Warning */}
                    {!apiKeyValue && (
                        <div
                            style={{
                                border: "2px solid var(--ion-color-danger)",
                                padding: "12px 16px",
                                borderRadius: "8px",
                                marginBottom: "16px",
                            }}
                        >
                            <IonText color="danger">
                                <p style={{ margin: 0, fontWeight: 500 }}>
                                    ⚠️ OpenAI API key not configured. Please add it in Settings to
                                    use this feature.
                                </p>
                            </IonText>
                        </div>
                    )}

                    {/* User Instructions Display */}
                    {config.userInstructions && (
                        <IonItem lines="none">
                            <IonLabel className="ion-text-wrap">
                                <IonText color="medium">
                                    <p>{config.userInstructions}</p>
                                </IonText>
                            </IonLabel>
                        </IonItem>
                    )}

                    {/* Text Input Section */}
                    <div style={{ marginTop: "16px" }}>
                        <IonItem>
                            <IonLabel position="stacked">
                                <h3>Text Input</h3>
                            </IonLabel>
                            <IonTextarea
                                value={userText}
                                onIonInput={(e) => setUserText(e.detail.value || "")}
                                placeholder="Enter your text here..."
                                rows={4}
                            />
                        </IonItem>
                    </div>

                    {/* File Attachments Section */}
                    <div style={{ marginTop: "16px" }}>
                        <IonItem lines="none">
                            <IonLabel>
                                <h3>Attachments</h3>
                            </IonLabel>
                            {isAllowCamera && (
                                <IonButton
                                    slot="end"
                                    fill="outline"
                                    size="small"
                                    onClick={handleCapture}
                                >
                                    <IonIcon icon={camera} slot="start" />
                                    Capture
                                </IonButton>
                            )}
                            {!isAllowCamera && (
                                <IonButton
                                    slot="end"
                                    fill="outline"
                                    size="small"
                                    onClick={handleAddAttachment}
                                >
                                    <IonIcon icon={attach} slot="start" />
                                    Add
                                </IonButton>
                            )}
                        </IonItem>

                        {attachments.length > 0 && (
                            <div
                                style={{
                                    padding: "0 16px",
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "8px",
                                }}
                            >
                                {attachments.map((attachment, index) => (
                                    <IonChip
                                        key={index}
                                        onClick={() => handleRemoveAttachment(index)}
                                    >
                                        <IonLabel>{attachment.name}</IonLabel>
                                        <IonIcon icon={close} />
                                    </IonChip>
                                ))}
                            </div>
                        )}

                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={handleFileInputChange}
                        />
                    </div>

                    {/* Run Button */}
                    {!response && (
                        <IonButton
                            expand="block"
                            onClick={handleRunLLM}
                            disabled={!apiKeyValue}
                            style={{ marginTop: "20px" }}
                        >
                            {config.buttonText || "Run LLM"}
                        </IonButton>
                    )}

                    {/* Output Display */}
                    {response && (
                        <div style={{ marginTop: "20px" }}>
                            <IonItem lines="none">
                                <IonLabel>
                                    <h3>Result</h3>
                                </IonLabel>
                            </IonItem>
                            <div style={{ padding: "0 16px" }}>{config.renderOutput(response)}</div>

                            {/* Accept/Cancel Buttons */}
                            <div
                                style={{
                                    marginTop: "20px",
                                    display: "flex",
                                    gap: "8px",
                                }}
                            >
                                <IonButton
                                    expand="block"
                                    fill="outline"
                                    onClick={handleClose}
                                    style={{ flex: 1 }}
                                >
                                    Cancel
                                </IonButton>
                                <IonButton
                                    expand="block"
                                    onClick={handleAccept}
                                    style={{ flex: 1 }}
                                >
                                    Accept
                                </IonButton>
                            </div>
                        </div>
                    )}
                </IonContent>
            </IonModal>
        </>
    );
};

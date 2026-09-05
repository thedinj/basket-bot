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
import React, { useRef, useState } from "react";
import { useShield } from "../../components/shield/useShield";
import { useToast } from "../../hooks/useToast";
import { useLLMConfig } from "../config/useLLMConfig";
import { runLLM } from "./runLLM";
import type { LLMAttachment } from "./types";
import { useLLMModalContext } from "./useLLMModalContext";

export const LLMModal: React.FC = () => {
    const { isOpen, config, closeModal, response, setResponse } = useLLMModalContext();
    const { showError } = useToast();
    // `effectiveConfig`, not `config`: the stored one omits every default the user never
    // overrode, so its model fields can be blank.
    const { effectiveConfig: llmConfig, provider, apiKey, isReady } = useLLMConfig();
    const { raiseShield, lowerShield } = useShield();
    const [attachments, setAttachments] = useState<LLMAttachment[]>([]);
    const [userText, setUserText] = useState("");
    const [interactionState, setInteractionState] = useState<unknown>(undefined);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isNative = Capacitor.isNativePlatform();

    const handleClose = () => {
        if (config?.onCancel) {
            config.onCancel();
        }

        // Reset state
        setAttachments([]);
        setUserText("");
        setInteractionState(undefined);
        closeModal();
    };

    const handleAccept = () => {
        if (!response || !config) return;

        config.onAccept(response, interactionState);
        setAttachments([]);
        setUserText("");
        setInteractionState(undefined);
        closeModal();
    };

    const handleCameraPhoto = async (source: CameraSource) => {
        if (!config) return;

        try {
            const image = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.Base64,
                source,
            });

            if (image.base64String) {
                const attachment: LLMAttachment = {
                    name: `image_${Date.now()}.${image.format}`,
                    data: image.base64String,
                    mimeType: `image/${image.format}`,
                };
                setAttachments((prev) => [...prev, attachment]);
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            // Only swallow genuine user cancellations
            if (message !== "User cancelled photos app" && message !== "No image picked") {
                showError(`Photo picker error: ${message}`);
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

        if (!isReady) {
            showError(`${provider.label} API key not configured. Please add it in Settings.`);
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
            let llmResponse = await runLLM({
                tier: config.tier,
                schema: config.schema,
                prompt: config.prompt,
                userText: trimmedText || undefined,
                attachments: attachments.length > 0 ? attachments : undefined,
                config: llmConfig,
                apiKey,
            });

            if (config.postProcess) {
                llmResponse = await config.postProcess(llmResponse);
            }

            setResponse(llmResponse);
            setInteractionState(config.initialState ? config.initialState(llmResponse) : undefined);
        } catch (error) {
            showError(error instanceof Error ? error.message : "Failed to call the LLM");
        } finally {
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
                    {!isReady && (
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
                                    ⚠️ {provider.label} API key not configured. Please add it in
                                    Settings to use this feature.
                                </p>
                            </IonText>
                        </div>
                    )}

                    {/* Text Input + Attachments + Run Button — hidden once results arrive */}
                    {response ? (
                        <div>
                            <IonItem lines="none">
                                <IonLabel>
                                    <h3>Result</h3>
                                </IonLabel>
                            </IonItem>
                            <div style={{ padding: "0 16px" }}>
                                {config.renderOutput(
                                    response,
                                    interactionState,
                                    setInteractionState
                                )}
                            </div>

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
                    ) : (
                        <div>
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
                                    {isNative ? (
                                        <>
                                            <IonButton
                                                slot="end"
                                                fill="outline"
                                                size="small"
                                                onClick={() =>
                                                    handleCameraPhoto(CameraSource.Camera)
                                                }
                                            >
                                                <IonIcon icon={camera} slot="start" />
                                                Camera
                                            </IonButton>
                                            <IonButton
                                                slot="end"
                                                fill="outline"
                                                size="small"
                                                onClick={() =>
                                                    handleCameraPhoto(CameraSource.Photos)
                                                }
                                            >
                                                <IonIcon icon={attach} slot="start" />
                                                Gallery
                                            </IonButton>
                                        </>
                                    ) : (
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
                            <IonButton
                                expand="block"
                                onClick={handleRunLLM}
                                disabled={!isReady}
                                style={{ marginTop: "20px" }}
                            >
                                {config.buttonText || "Run LLM"}
                            </IonButton>
                        </div>
                    )}
                </IonContent>
            </IonModal>
        </>
    );
};

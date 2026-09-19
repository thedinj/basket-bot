import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { IonButton, IonContent, IonIcon, IonModal, IonSpinner, IonTextarea } from "@ionic/react";
import { attach, camera, close, imageOutline } from "ionicons/icons";
import React, { useRef, useState } from "react";
import { EditorFooter } from "../../components/shared/EditorFooter";
import { FormField } from "../../components/shared/FormField";
import { ModalHeader } from "../../components/shared/ModalHeader";
import { RobotLine } from "../../components/shared/RobotLine";
import RobotLoadingContent from "../../components/shared/RobotLoadingContent";
import { useLLMConfig } from "../config/useLLMConfig";
import "./LLMChrome.scss";
import { runLLM } from "./runLLM";
import type { LLMAttachment } from "./types";
import { useLLMModalContext } from "./useLLMModalContext";

/**
 * The generic AI sheet: input step → running → review step.
 *
 * Layout contract for `renderOutput`: the sheet's IonContent keeps `ion-padding` (16px) and the
 * result is rendered as its direct child, with no wrapper, heading or extra padding, so a
 * renderer lays itself out flush on the 16px gutter. Actions live in the IonFooter.
 */
export const LLMModal: React.FC = () => {
    const { isOpen, config, closeModal, response, setResponse } = useLLMModalContext();
    // `effectiveConfig`, not `config`: the stored one omits every default the user never
    // overrode, so its model fields can be blank.
    const { effectiveConfig: llmConfig, provider, apiKey, isReady } = useLLMConfig();
    const [attachments, setAttachments] = useState<LLMAttachment[]>([]);
    const [userText, setUserText] = useState("");
    const [interactionState, setInteractionState] = useState<unknown>(undefined);
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Bumped whenever the sheet is reset, so a run that resolves after its sheet was closed
    // doesn't write a stale result into the next one.
    const runIdRef = useRef(0);
    const isNative = Capacitor.isNativePlatform();

    const resetState = () => {
        runIdRef.current += 1;
        setAttachments([]);
        setUserText("");
        setInteractionState(undefined);
        setIsRunning(false);
        setError(null);
    };

    const handleClose = () => {
        if (config?.onCancel) {
            config.onCancel();
        }

        resetState();
        closeModal();
    };

    const handleAccept = () => {
        if (!response || !config) return;

        config.onAccept(response, interactionState);
        resetState();
        closeModal();
    };

    /** Review step → input step, keeping the text and photos so the run can be adjusted. */
    const handleBackToInput = () => {
        setResponse(null);
        setInteractionState(undefined);
        setError(null);
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
                setError(null);
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            // Only swallow genuine user cancellations
            if (message !== "User cancelled photos app" && message !== "No image picked") {
                setError(`Photo picker error: ${message}`);
            }
        }
    };

    const handleAddAttachment = () => {
        if (!config) return;
        if (isNative) {
            void handleCameraPhoto(CameraSource.Photos);
            return;
        }
        fileInputRef.current?.click();
    };

    const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const newAttachments: LLMAttachment[] = [];
        const failed: string[] = [];

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
                failed.push(file.name);
            }
        }

        setAttachments((prev) => [...prev, ...newAttachments]);
        setError(failed.length > 0 ? `Failed to read file: ${failed.join(", ")}` : null);

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleRemoveAttachment = (index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    const handleRunLLM = async () => {
        if (!config || isRunning) return;

        if (!isReady) {
            setError(`${provider.label} API key not configured. Please add it in Settings.`);
            return;
        }

        // Validate at least one input type is provided
        const trimmedText = userText.trim();
        if (attachments.length === 0 && !trimmedText) {
            setError("Please provide at least one input: text or attachment.");
            return;
        }

        const runId = ++runIdRef.current;
        setIsRunning(true);
        setError(null);
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

            if (runId !== runIdRef.current) return;
            setResponse(llmResponse);
            setInteractionState(config.initialState ? config.initialState(llmResponse) : undefined);
        } catch (error) {
            if (runId !== runIdRef.current) return;
            setError(error instanceof Error ? error.message : "Failed to call the LLM");
        } finally {
            if (runId === runIdRef.current) {
                setIsRunning(false);
            }
        }
    };

    if (!config) return null;

    const hasInput = attachments.length > 0 || userText.trim().length > 0;
    const runLabel = error && hasInput ? "Retry" : config.buttonText || "Run";

    const renderInputStep = () => (
        <div className="editor-form">
            {config.userInstructions && (
                <p className="llm-sheet__instructions">{config.userInstructions}</p>
            )}

            <FormField label="Text">
                <div className="form-control form-control--multiline">
                    <IonTextarea
                        aria-label="Text"
                        value={userText}
                        onIonInput={(e) => setUserText(e.detail.value || "")}
                        placeholder="Paste or type here"
                        rows={5}
                        autoGrow
                    />
                </div>
            </FormField>

            <FormField
                label="Photos"
                action={
                    <div className="llm-sheet__actions">
                        {isNative && (
                            <button
                                type="button"
                                className="form-field__action"
                                onClick={() => handleCameraPhoto(CameraSource.Camera)}
                            >
                                <IonIcon icon={camera} aria-hidden="true" />
                                Camera
                            </button>
                        )}
                        <button
                            type="button"
                            className="form-field__action"
                            onClick={handleAddAttachment}
                        >
                            <IonIcon icon={attach} aria-hidden="true" />
                            {isNative ? "Gallery" : "Add"}
                        </button>
                    </div>
                }
            >
                {attachments.length > 0 ? (
                    <ul className="llm-sheet__attachments">
                        {attachments.map((attachment, index) => (
                            <li key={`${attachment.name}-${index}`} className="form-control">
                                <IonIcon
                                    icon={imageOutline}
                                    className="llm-sheet__attachment-icon"
                                    aria-hidden="true"
                                />
                                <span className="form-control__value">{attachment.name}</span>
                                <button
                                    type="button"
                                    className="form-control__icon-button form-control__icon-button--end"
                                    onClick={() => handleRemoveAttachment(index)}
                                    aria-label={`Remove ${attachment.name}`}
                                >
                                    <IonIcon icon={close} aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <button
                        type="button"
                        className="form-control form-control--button"
                        onClick={handleAddAttachment}
                    >
                        <span className="form-control__value form-control__placeholder">
                            No photos attached
                        </span>
                        <IonIcon icon={attach} className="form-control__trail" aria-hidden="true" />
                    </button>
                )}

                {/* Hidden file input (web) */}
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="llm-sheet__file-input"
                    onChange={handleFileInputChange}
                />
            </FormField>

            {error && (
                <p className="form-field__error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );

    const renderRunning = () => (
        <div className="llm-sheet__running" aria-live="polite">
            <div className="llm-sheet__robot">
                <RobotLoadingContent message={null} />
            </div>
            <RobotLine className="llm-sheet__robot-line">
                {config.shieldMessage || "Processing. Stand by."}
            </RobotLine>
        </div>
    );

    return (
        <IonModal
            isOpen={isOpen}
            // Only a swipe/backdrop dismiss still has isOpen set; Close and Accept have already
            // closed (and, for Accept, must not then fire onCancel).
            onDidDismiss={() => isOpen && handleClose()}
            canDismiss={!isRunning}
        >
            <ModalHeader
                title={config.title || "AI Assistant"}
                onClose={handleClose}
                closeDisabled={isRunning}
            />

            <IonContent className="ion-padding">
                {!isReady && !response && !isRunning && (
                    <p className="llm-sheet__notice" role="alert">
                        {provider.label} API key not configured. Add it in Settings to use this
                        feature.
                    </p>
                )}

                {isRunning
                    ? renderRunning()
                    : response
                      ? config.renderOutput(response, interactionState, setInteractionState)
                      : renderInputStep()}
            </IonContent>

            <EditorFooter
                onBack={response && !isRunning ? handleBackToInput : undefined}
                backLabel="Back to input"
            >
                {response && !isRunning ? (
                    <IonButton
                        expand="block"
                        className="editor-form__submit"
                        onClick={handleAccept}
                    >
                        Accept
                    </IonButton>
                ) : (
                    <IonButton
                        expand="block"
                        className="editor-form__submit"
                        onClick={handleRunLLM}
                        disabled={!isReady || isRunning}
                    >
                        {isRunning ? <IonSpinner name="dots" /> : runLabel}
                    </IonButton>
                )}
            </EditorFooter>
        </IonModal>
    );
};

import { IonAlert, IonButton, IonIcon } from "@ionic/react";
import React, { ComponentProps, useState } from "react";
import { useSecureApiKey } from "../../hooks/useSecureStorage";
import { LLM_COLOR, LLM_ICON_SRC } from "./constants";

interface LLMButtonProps extends ComponentProps<typeof IonButton> {
    /** Icon-only mode (no text, just the robot icon) */
    iconOnly?: boolean;
}

/**
 * Reusable button for triggering LLM features
 * Distinctive styling: purple border, robot icon, robotic font
 * Shows alert if clicked without API key configured
 */
export const LLMButton: React.FC<LLMButtonProps> = ({
    children,
    expand = "block",
    style,
    onClick,
    iconOnly = false,
    ...props
}) => {
    const apiKeyValue = useSecureApiKey();
    const [showApiKeyAlert, setShowApiKeyAlert] = useState(false);

    const handleClick = (e: React.MouseEvent<HTMLIonButtonElement>) => {
        if (!apiKeyValue) {
            setShowApiKeyAlert(true);
            return;
        }
        onClick?.(e);
    };

    return (
        <>
            <IonButton
                fill="outline"
                expand={iconOnly ? undefined : expand}
                onClick={handleClick}
                style={{
                    "--border-color": LLM_COLOR,
                    "--border-width": "2px",
                    "--color": LLM_COLOR,
                    letterSpacing: "0.5px",
                    textTransform: "none",
                    ...(iconOnly && {
                        width: "56px",
                        minWidth: "56px",
                        alignSelf: "stretch",
                        "--padding-start": "0",
                        "--padding-end": "0",
                    }),
                    ...style,
                }}
                {...props}
            >
                {iconOnly ? (
                    <IonIcon
                        src={LLM_ICON_SRC}
                        style={{
                            fontSize: "28px",
                        }}
                    />
                ) : (
                    <>
                        <IonIcon src={LLM_ICON_SRC} slot="start" />
                        {children}
                    </>
                )}
            </IonButton>

            <IonAlert
                isOpen={showApiKeyAlert}
                onDidDismiss={() => setShowApiKeyAlert(false)}
                header="API Key Required"
                message="OpenAI API key not configured. Please add it in Settings to use this feature."
                buttons={["OK"]}
            />
        </>
    );
};

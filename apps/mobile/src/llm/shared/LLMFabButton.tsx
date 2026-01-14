import React, { ComponentProps, useState } from "react";
import { IonFabButton, IonIcon, IonAlert } from "@ionic/react";
import { useSecureApiKey } from "../../hooks/useSecureStorage";
import { LLM_ICON_SRC, LLM_COLOR, LLM_COLOR_ACTIVATED } from "./constants";

/**
 * FAB button for LLM features with distinctive styling
 * Shows alert if clicked without API key configured
 */
export const LLMFabButton: React.FC<ComponentProps<typeof IonFabButton>> = ({
    onClick,
    ...props
}) => {
    const apiKeyValue = useSecureApiKey();
    const [showApiKeyAlert, setShowApiKeyAlert] = useState(false);

    const handleClick = (e: React.MouseEvent<HTMLIonFabButtonElement>) => {
        if (!apiKeyValue) {
            setShowApiKeyAlert(true);
            return;
        }
        onClick?.(e);
    };

    return (
        <>
            <IonFabButton
                onClick={handleClick}
                style={{
                    "--background": LLM_COLOR,
                    "--background-activated": LLM_COLOR_ACTIVATED,
                    "--background-hover": LLM_COLOR_ACTIVATED,
                }}
                {...props}
            >
                <IonIcon src={LLM_ICON_SRC} />
            </IonFabButton>

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

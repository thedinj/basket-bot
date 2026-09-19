import { IonAlert, IonFabButton, IonIcon } from "@ionic/react";
import clsx from "clsx";
import React, { ComponentProps, useState } from "react";
import { useLLMConfig } from "../config/useLLMConfig";
import { LLM_ICON_SRC } from "./constants";
import "./LLMChrome.scss";

/**
 * FAB for LLM features: the robot glyph on a lilac wash (styles in LLMChrome.scss), so it reads
 * as the AI accent beside the solid primary FAB. Pass a specific `aria-label` ("Import recipe").
 * Shows an alert if clicked without an API key configured.
 */
export const LLMFabButton: React.FC<ComponentProps<typeof IonFabButton>> = ({
    onClick,
    className,
    ...props
}) => {
    const { provider, isReady } = useLLMConfig();
    const [showApiKeyAlert, setShowApiKeyAlert] = useState(false);

    const handleClick = (e: React.MouseEvent<HTMLIonFabButtonElement>) => {
        if (!isReady) {
            setShowApiKeyAlert(true);
            return;
        }
        onClick?.(e);
    };

    return (
        <>
            <IonFabButton
                onClick={handleClick}
                className={clsx("llm-fab-button", className)}
                aria-label="AI import"
                {...props}
            >
                <IonIcon src={LLM_ICON_SRC} aria-hidden="true" />
            </IonFabButton>

            <IonAlert
                isOpen={showApiKeyAlert}
                onDidDismiss={() => setShowApiKeyAlert(false)}
                header="API Key Required"
                message={`${provider.label} API key not configured. Please add it in Settings to use this feature.`}
                buttons={["OK"]}
            />
        </>
    );
};

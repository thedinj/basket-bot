import { IonAlert, IonButton, IonIcon } from "@ionic/react";
import clsx from "clsx";
import React, { ComponentProps, useState } from "react";
import { useLLMConfig } from "../config/useLLMConfig";
import { LLM_ICON_SRC } from "./constants";
import "./LLMChrome.scss";

interface LLMButtonProps extends ComponentProps<typeof IonButton> {
    /** Icon-only mode (no text, just the robot icon). Pass an `aria-label`. */
    iconOnly?: boolean;
}

/**
 * Reusable button for triggering LLM features: the robot glyph on a 48px lilac-tinted button
 * (styles in LLMChrome.scss). Shows an alert if clicked without an API key configured.
 */
export const LLMButton: React.FC<LLMButtonProps> = ({
    children,
    expand = "block",
    className,
    onClick,
    iconOnly = false,
    ...props
}) => {
    const { provider, isReady } = useLLMConfig();
    const [showApiKeyAlert, setShowApiKeyAlert] = useState(false);

    const handleClick = (e: React.MouseEvent<HTMLIonButtonElement>) => {
        if (!isReady) {
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
                className={clsx("llm-button", iconOnly && "llm-button--icon", className)}
                aria-label={iconOnly ? "AI assist" : undefined}
                {...props}
            >
                {iconOnly ? (
                    <IonIcon slot="icon-only" src={LLM_ICON_SRC} aria-hidden="true" />
                ) : (
                    <>
                        <IonIcon src={LLM_ICON_SRC} slot="start" aria-hidden="true" />
                        {children}
                    </>
                )}
            </IonButton>

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

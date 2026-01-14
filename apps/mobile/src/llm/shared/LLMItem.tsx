import { IonIcon, IonItem, IonLabel } from "@ionic/react";
import React, { ComponentProps } from "react";
import { useSecureApiKey } from "../../hooks/useSecureStorage";
import { LLM_COLOR, LLM_ICON_SRC } from "./constants";

type LLMItemProps = ComponentProps<typeof IonItem> & {
    /** Whether to auto-disable when no API key is configured (default: true) */
    requireApiKey?: boolean;
};

/**
 * Reusable list item for triggering LLM features
 * Distinctive styling: purple border, robot icon, robotic font
 * Automatically disabled if no API key is configured (unless requireApiKey=false)
 */
export const LLMItem: React.FC<LLMItemProps> = ({
    children,
    disabled = false,
    requireApiKey = true,
    style,
    ...props
}) => {
    const apiKeyValue = useSecureApiKey();
    const isDisabled = disabled || (requireApiKey && !apiKeyValue);

    return (
        <IonItem
            disabled={isDisabled}
            style={{
                "--border-color": LLM_COLOR,
                "--border-width": "2px",
                "--border-style": "solid",
                "--border-radius": "8px",
                "--inner-border-width": "0",
                marginBottom: "8px",
                ...style,
            }}
            {...props}
        >
            <IonIcon
                src={LLM_ICON_SRC}
                slot="start"
                style={{ color: LLM_COLOR }}
            />
            {typeof children === "string" ? (
                <IonLabel
                    style={{
                        color: LLM_COLOR,
                        letterSpacing: "0.5px",
                    }}
                >
                    {children}
                </IonLabel>
            ) : React.isValidElement(children) && children.type === IonLabel ? (
                React.cloneElement(
                    children as React.ReactElement<
                        ComponentProps<typeof IonLabel>
                    >,
                    {
                        style: {
                            color: LLM_COLOR,
                            letterSpacing: "0.5px",
                            ...((
                                children as React.ReactElement<
                                    ComponentProps<typeof IonLabel>
                                >
                            ).props.style || {}),
                        },
                    }
                )
            ) : (
                <IonLabel
                    style={{
                        color: LLM_COLOR,
                        letterSpacing: "0.5px",
                    }}
                >
                    {children}
                </IonLabel>
            )}
        </IonItem>
    );
};

import { IonIcon, IonItem, IonLabel } from "@ionic/react";
import clsx from "clsx";
import React, { ComponentProps } from "react";
import { useLLMConfig } from "../config/useLLMConfig";
import { LLM_ICON_SRC } from "./constants";
import "./LLMChrome.scss";

type LLMItemProps = ComponentProps<typeof IonItem> & {
    /** Whether to auto-disable when no API key is configured (default: true) */
    requireApiKey?: boolean;
};

/**
 * Reusable list row for triggering LLM features: the robot glyph on the 16px gutter and a lilac
 * label 14px after it, hairline-divided (styles in LLMChrome.scss). A string child is wrapped in
 * an IonLabel; pass your own IonLabel for richer content.
 * Automatically disabled if no API key is configured (unless requireApiKey=false).
 */
export const LLMItem: React.FC<LLMItemProps> = ({
    children,
    disabled = false,
    requireApiKey = true,
    className,
    ...props
}) => {
    const { isReady } = useLLMConfig();
    const isDisabled = disabled || (requireApiKey && !isReady);

    return (
        <IonItem disabled={isDisabled} className={clsx("llm-item", className)} {...props}>
            <IonIcon src={LLM_ICON_SRC} slot="start" aria-hidden="true" />
            {React.isValidElement(children) && children.type === IonLabel ? (
                children
            ) : (
                <IonLabel>{children}</IonLabel>
            )}
        </IonItem>
    );
};

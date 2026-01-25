import { IonIcon, IonText } from "@ionic/react";
import type React from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LLM_COLOR_ACTIVATED, LLM_ICON_SRC } from "../../llm/shared/constants";
import "./Shield.css";
import { useShield } from "./useShield";

export const Shield: React.FC = () => {
    const { activeShieldIds, currentMessage } = useShield();
    const [isVisible, setIsVisible] = useState(false);
    const [showContent, setShowContent] = useState(false);

    const isActive = activeShieldIds.size > 0;

    useEffect(() => {
        if (isActive) {
            setIsVisible(true);
            // After 500ms, fade in the content (background + icon)
            const timer = setTimeout(() => {
                setShowContent(true);
            }, 500);
            return () => clearTimeout(timer);
        } else {
            setShowContent(false);
            setIsVisible(false);
        }
    }, [isActive]);

    if (!isVisible) {
        return null;
    }

    const shieldElement = (
        <div className={`shield-overlay ${showContent ? "show-content" : ""}`}>
            <div className="shield-content">
                <IonIcon
                    src={LLM_ICON_SRC}
                    className="shield-icon"
                    style={{ fontSize: 80, color: LLM_COLOR_ACTIVATED }}
                />
                {currentMessage && (
                    <IonText color="medium" className="shield-message">
                        <p>{currentMessage}</p>
                    </IonText>
                )}
            </div>
        </div>
    );

    return createPortal(shieldElement, document.body);
};

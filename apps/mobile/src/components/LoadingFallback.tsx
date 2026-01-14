import { IonIcon, IonText } from "@ionic/react";
import { LLM_COLOR_ACTIVATED, LLM_ICON_SRC } from "../llm/shared";
import "./LoadingFallback.css";

const LoadingFallback: React.FC = () => {
    return (
        <div className="loading-fallback">
            <IonIcon
                src={LLM_ICON_SRC}
                className="floating-icon"
                style={{ fontSize: 80, color: LLM_COLOR_ACTIVATED }}
            />
            <IonText color="medium">
                <p>Processing... Even you must wait.</p>
            </IonText>
        </div>
    );
};

export default LoadingFallback;

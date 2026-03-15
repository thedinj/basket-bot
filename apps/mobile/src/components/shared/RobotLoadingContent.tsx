import { IonIcon, IonText } from "@ionic/react";
import { LLM_COLOR_ACTIVATED, LLM_ICON_SRC } from "../../llm/shared/constants";
import "./RobotLoadingContent.css";

interface RobotLoadingContentProps {
    message?: string;
}

const RobotLoadingContent: React.FC<RobotLoadingContentProps> = ({ message }) => {
    return (
        <>
            <IonIcon
                src={LLM_ICON_SRC}
                className="robot-loading-icon"
                style={{ color: LLM_COLOR_ACTIVATED }}
            />
            {message && (
                <IonText color="medium" className="robot-loading-message">
                    <p>{message}</p>
                </IonText>
            )}
        </>
    );
};

export default RobotLoadingContent;

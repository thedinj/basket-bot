import { IonIcon, IonText } from "@ionic/react";
import { LLM_COLOR_ACTIVATED, LLM_ICON_SRC, ROBOT_LOADING_MESSAGES } from "../../llm/shared/constants";
import "./RobotLoadingContent.css";

// Keyed to the current minute so all instances default to the same message during a
// session, but it rotates each time the user opens the app at a different minute.
const DEFAULT_MESSAGE =
    ROBOT_LOADING_MESSAGES[new Date().getMinutes() % ROBOT_LOADING_MESSAGES.length];

interface RobotLoadingContentProps {
    /** Defaults to a rotating session message; pass `null` to render the icon with no caption. */
    message?: string | null;
}

const RobotLoadingContent: React.FC<RobotLoadingContentProps> = ({
    message = DEFAULT_MESSAGE,
}) => {
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

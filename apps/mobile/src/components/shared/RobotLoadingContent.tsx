import { IonIcon } from "@ionic/react";
import { LLM_ICON_SRC, ROBOT_LOADING_MESSAGES } from "../../llm/shared/constants";
import "./RobotLoadingContent.css";
import { RobotLine } from "./RobotLine";

// Keyed to the current minute so all instances default to the same message during a
// session, but it rotates each time the user opens the app at a different minute.
const DEFAULT_MESSAGE =
    ROBOT_LOADING_MESSAGES[new Date().getMinutes() % ROBOT_LOADING_MESSAGES.length];

interface RobotLoadingContentProps {
    /** Defaults to a rotating session message; pass `null` to render the icon with no caption. */
    message?: string | null;
}

/**
 * The robot mascot plus its status line, as one centered column. Callers only position it
 * (centering, min-height); the icon-to-line spacing lives here.
 *
 * The caption is a `RobotLine` (mono, field frame, lilac prompt, blinking cursor), the robot's
 * usual aside. It is announced as a polite status;
 * the mascot itself is decorative. With `message={null}` there is nothing to announce, so the
 * caller (e.g. ServerUnreachable) owns the live region.
 */
const RobotLoadingContent: React.FC<RobotLoadingContentProps> = ({ message = DEFAULT_MESSAGE }) => (
    <div
        className="robot-loading"
        role={message ? "status" : undefined}
        aria-live={message ? "polite" : undefined}
    >
        <IonIcon src={LLM_ICON_SRC} className="robot-loading__icon" aria-hidden="true" />
        {message && <RobotLine className="robot-loading__line">{message}</RobotLine>}
    </div>
);

export default RobotLoadingContent;

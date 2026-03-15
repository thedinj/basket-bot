import { ROBOT_LOADING_MESSAGES } from "../llm/shared/constants";
import "./LoadingFallback.css";
import RobotLoadingContent from "./shared/RobotLoadingContent";

// Keyed to the current minute so all instances show the same message during startup,
// but it rotates each time the user opens the app at a different minute.
const SESSION_DEFAULT_MESSAGE =
    ROBOT_LOADING_MESSAGES[new Date().getMinutes() % ROBOT_LOADING_MESSAGES.length];

interface LoadingFallbackProps {
    message?: string;
}

const LoadingFallback: React.FC<LoadingFallbackProps> = ({ message }) => {
    return (
        <div className="loading-fallback">
            <RobotLoadingContent message={message ?? SESSION_DEFAULT_MESSAGE} />
        </div>
    );
};

export default LoadingFallback;

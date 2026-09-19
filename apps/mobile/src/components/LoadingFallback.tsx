import "./LoadingFallback.css";
import RobotLoadingContent from "./shared/RobotLoadingContent";

interface LoadingFallbackProps {
    message?: string;
}

/** Full-height Suspense fallback: the robot and its status line, centered. */
const LoadingFallback: React.FC<LoadingFallbackProps> = ({ message }) => {
    return (
        <div className="loading-fallback" aria-busy="true">
            <RobotLoadingContent message={message} />
        </div>
    );
};

export default LoadingFallback;

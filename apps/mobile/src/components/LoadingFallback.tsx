import "./LoadingFallback.css";
import RobotLoadingContent from "./shared/RobotLoadingContent";

interface LoadingFallbackProps {
    message?: string;
}

const LoadingFallback: React.FC<LoadingFallbackProps> = ({ message }) => {
    return (
        <div className="loading-fallback">
            <RobotLoadingContent message={message} />
        </div>
    );
};

export default LoadingFallback;

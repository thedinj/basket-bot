import { Component, ErrorInfo, ReactNode } from "react";

type ErrorBoundaryProps = {
    children: ReactNode;
};

type ErrorBoundaryState = {
    error: Error | null;
};

export class AppErrorBoundary extends Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("AppErrorBoundary caught an error", error, info);
    }

    render() {
        if (this.state.error) {
            return (
                <div role="alert">
                    <p>Something went wrong!</p>
                    <p>{this.state.error.message}</p>
                </div>
            );
        }

        return this.props.children;
    }
}

export default AppErrorBoundary;

import { Component, ErrorInfo, ReactNode } from "react";
import { ApiError } from "../lib/api/client";
import { serverReachability } from "../lib/serverReachability";
import ServerUnreachable from "./ServerUnreachable";

type ErrorBoundaryProps = {
    children: ReactNode;
};

type ErrorBoundaryState = {
    error: Error | null;
};

/**
 * A failed *suspense* query has nowhere to go but here: it throws on render, so unlike a
 * normal query it cannot fall back to an error state inside the page. A backend outage
 * therefore reaches this boundary once TanStack's retries are exhausted, and rendering the
 * generic message for it replaced the whole app — tabs, banner and all — with a dead end
 * offering no way back short of a reload.
 *
 * So an outage gets the same recoverable screen as a cold start, and the boundary clears
 * itself the moment the server answers again. Everything else still falls through to the
 * generic message, which is what a genuine bug should look like.
 */
export class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { error: null };
    private unsubscribe: (() => void) | null = null;

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidMount() {
        this.unsubscribe = serverReachability.subscribe(() => {
            // Recovered: drop the caught error so the tree re-renders and refetches. The
            // alternative is telling the user we're back while still showing them a wall.
            if (!serverReachability.isUnreachable() && this.state.error) {
                this.setState({ error: null });
            }
        });
    }

    componentWillUnmount() {
        this.unsubscribe?.();
        this.unsubscribe = null;
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("AppErrorBoundary caught an error", error, info);
    }

    render() {
        const { error } = this.state;

        if (error) {
            if (error instanceof ApiError && error.isNetworkError) {
                return <ServerUnreachable />;
            }

            return (
                <div role="alert">
                    <p>Something went wrong!</p>
                    <p>{error.message}</p>
                </div>
            );
        }

        return this.props.children;
    }
}

export default AppErrorBoundary;

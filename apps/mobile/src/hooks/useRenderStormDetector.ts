import { useEffect, useRef } from "react";
import {
    isDevelopment,
    RENDER_STORM_COOLDOWN,
    RENDER_STORM_RATE_THRESHOLD,
    RENDER_STORM_TIME_WINDOW,
} from "../utils/devUtils";

/**
 * Simple render storm detector that tracks renders within a time window.
 * Logs warning and triggers debugger when render rate exceeds threshold.
 * Only active in development mode.
 *
 * @param componentName - Name of the component for logging
 * @param props - Optional props object to track which props are changing
 *
 * @example
 * ```tsx
 * const MyComponent: React.FC<MyComponentProps> = (props) => {
 *     useRenderStormDetector("MyComponent", props);
 *     // ... rest of component
 * };
 * ```
 */
export const useRenderStormDetector = (
    componentName: string,
    props?: Record<string, unknown>
): void => {
    // Track render timestamps within the time window
    const renderTimestampsRef = useRef<number[]>([]);
    // Track whether we've already warned about current storm
    const hasWarnedRef = useRef(false);
    // Track last time we were below threshold (for cooldown/debouncing)
    const lastBelowThresholdRef = useRef<number>(Date.now());
    // Track previous props for change detection
    const prevPropsRef = useRef<Record<string, unknown> | undefined>(props);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            renderTimestampsRef.current = [];
        };
    }, []);

    // Only process in development
    if (!isDevelopment()) {
        return;
    }

    // Record this render
    const now = Date.now();
    renderTimestampsRef.current.push(now);

    // Remove timestamps outside the time window (sliding window)
    const windowStart = now - RENDER_STORM_TIME_WINDOW;
    renderTimestampsRef.current = renderTimestampsRef.current.filter((ts) => ts >= windowStart);

    const rendersInWindow = renderTimestampsRef.current.length;

    // Check if we're in a storm
    const isStorm = rendersInWindow >= RENDER_STORM_RATE_THRESHOLD;

    if (isStorm) {
        // Only warn once per storm cycle
        if (!hasWarnedRef.current) {
            hasWarnedRef.current = true;

            // Detect changed props
            let changedProps: string[] = [];
            if (props && prevPropsRef.current) {
                changedProps = getChangedProps(prevPropsRef.current, props);
            }

            // Log detailed warning
            console.error(
                `🔥 RENDER STORM DETECTED: ${componentName}\n` +
                    `   ${rendersInWindow} renders in ${RENDER_STORM_TIME_WINDOW}ms\n` +
                    `   Threshold: ${RENDER_STORM_RATE_THRESHOLD} renders\n` +
                    (changedProps.length > 0
                        ? `   Changed props: ${changedProps.join(", ")}\n`
                        : `   No prop changes detected\n`) +
                    `   Check component logic and memo usage.`
            );

            // Trigger debugger to help investigate
            // eslint-disable-next-line no-debugger
            debugger;
        }
    } else {
        // Track when we drop below threshold for debouncing
        lastBelowThresholdRef.current = now;

        // Reset warning flag if we've been below threshold for cooldown period
        const timeSinceBelowThreshold = now - lastBelowThresholdRef.current;
        if (hasWarnedRef.current && timeSinceBelowThreshold >= RENDER_STORM_COOLDOWN) {
            hasWarnedRef.current = false;
        }
    }

    // Update previous props for next render
    prevPropsRef.current = props;
};

/**
 * Detect which props changed between renders using shallow comparison.
 */
const getChangedProps = (
    prev: Record<string, unknown>,
    current: Record<string, unknown>
): string[] => {
    const changed: string[] = [];

    // Check all keys in current props
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(current)]);

    for (const key of allKeys) {
        if (prev[key] !== current[key]) {
            changed.push(key);
        }
    }

    return changed;
};

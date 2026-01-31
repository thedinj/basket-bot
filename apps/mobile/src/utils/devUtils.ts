/**
 * Development utilities for debugging and monitoring.
 * All code in this module is tree-shaken out of production builds by Vite.
 */

/**
 * Check if the app is running in development mode.
 * Uses Vite's built-in DEV flag which is set to true during `vite dev`
 * and false during `vite build`.
 */
export const isDevelopment = (): boolean => {
    return import.meta.env.DEV;
};

/**
 * Time window (in milliseconds) for detecting render storms.
 * If a component renders more than RENDER_STORM_RATE_THRESHOLD times
 * within this window, it triggers a storm warning.
 */
export const RENDER_STORM_TIME_WINDOW = 2000; // 2 seconds

/**
 * Number of renders within RENDER_STORM_TIME_WINDOW that triggers a storm warning.
 */
export const RENDER_STORM_RATE_THRESHOLD = 50;

/**
 * Cooldown period (in milliseconds) after a storm before resetting the warning flag.
 * If render rate drops and stays below threshold for this duration, warnings can trigger again.
 */
export const RENDER_STORM_COOLDOWN = 5000; // 5 seconds

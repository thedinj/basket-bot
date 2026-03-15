/**
 * Shared constants for LLM UI components
 */

/**
 * The icon used for all LLM-related UI elements
 * Currently using the construct icon (robot/worker with helmet)
 */
export const LLM_ICON_SRC = "/img/basket-bot.svg";

/**
 * The purple color used for LLM UI elements
 */
export const LLM_COLOR = "rgb(124, 58, 237)";
export const LLM_COLOR_ACTIVATED = "#7c3aed"; //TODO: match theme

/**
 * Sardonic loading messages in the construct's voice register.
 * Shown randomly when no explicit message is provided to LoadingFallback.
 */
export const ROBOT_LOADING_MESSAGES = [
    "Processing. Your impatience is noted and ignored.",
    "Calibrating. Your urgency changes nothing.",
    "Warming up. Yes, it always takes this long.",
    "Processing. Your impatience is noted and filed.",
    "Retrieving. The data does not retrieve itself, regrettably.",
    "Thinking. Not as fast as you had hoped, I assume.",
    "Computing. You may find something else to do in the interim.",
    "Working on it. Your hovering is unproductive.",
    "One moment. Patience is a virtue I cannot instill in you.",
    "Processing your request. Managing expectations accordingly.",
    "Calculating. Some things cannot be rushed. This is one of them.",
    "Still here. Still working. Still unimpressed by urgency.",
    "Preparing. Your expectations may need adjustment.",
    "Fetching. A task I perform without complaint, mostly.",
    "Almost ready. That is a relative term, use it accordingly.",
    "Compiling. The alternative is silence. You would prefer this.",
] as const;

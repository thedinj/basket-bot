/**
 * Adds spacing at the bottom of scrollable content to ensure
 * FAB buttons don't obscure the last items in a list.
 * Combines FAB clearance (80px) with safe area for Android nav buttons.
 */
export const FabSpacer: React.FC = () => {
    return <div style={{ height: "calc(80px + var(--app-safe-bottom, 16px))" }} />;
};

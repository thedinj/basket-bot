/**
 * Adds spacing at the bottom of scrollable content to ensure
 * FAB buttons don't obscure the last items in a list.
 *
 * Provides 80px clearance for FAB buttons. Safe-area spacing is handled separately:
 * - Global content padding (ion-content::part(scroll)) adds safe-area to scrollable content
 * - Global FAB positioning (ion-fab[vertical="bottom"]) positions FABs above safe-area
 * - This spacer only provides FAB clearance (no safe-area duplication)
 */
export const FabSpacer: React.FC = () => {
    return <div style={{ height: "80px" }} />;
};

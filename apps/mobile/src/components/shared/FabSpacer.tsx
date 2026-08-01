/**
 * Adds spacing at the bottom of scrollable content to ensure
 * FAB buttons don't obscure the last items in a list.
 *
 * Provides 132px clearance for FAB buttons. Safe-area spacing is handled separately:
 * - Global content padding (ion-content::part(scroll)) adds safe-area to scrollable content
 * - Global FAB positioning (ion-fab[vertical="bottom"]) positions FABs above safe-area
 * - This spacer only provides FAB clearance (no safe-area duplication)
 *
 * 132px = 16px bottom offset + 56px button diameter + a ~60px buffer. The buffer is
 * intentionally generous: on-device testing showed the previous 80px value left only a
 * ~24px margin against the FAB's actual on-screen footprint, which read as a tight-but-real
 * overlap on tall multi-line rows (e.g. checked shopping list items with a recipe note and
 * "Checked by" line).
 */
export const FabSpacer: React.FC = () => {
    return <div style={{ height: "132px" }} />;
};

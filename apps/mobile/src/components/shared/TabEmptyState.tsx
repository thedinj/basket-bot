import { IonIcon, IonText } from "@ionic/react";

import "./TabEmptyState.scss";

/**
 * How much vertical space the empty state should claim. This only controls centering —
 * the icon, copy and action look identical in all three.
 *
 * - `page` (default): fills the scroll box minus the trailing `<FabSpacer />`'s clearance,
 *   so the copy centers against the visible area. Use on any tab/modal that renders an `IonFab`.
 * - `full`: fills the whole scroll box. Same idea, for content with no FAB to clear —
 *   modals, and pages whose FAB is hidden in the state that produced this empty view.
 * - `inline`: claims no minimum height at all. Use when the empty state sits inside a panel
 *   alongside other content rather than replacing a screenful of it.
 */
type TabEmptyStateVariant = "page" | "full" | "inline";

interface TabEmptyStateProps {
    /** Ionicon shown in the circular badge. Omit for a bare message (e.g. "no search results"). */
    icon?: string;
    title?: string;
    body: React.ReactNode;
    /** Optional call to action rendered below the copy. */
    action?: React.ReactNode;
    variant?: TabEmptyStateVariant;
}

const TabEmptyState: React.FC<TabEmptyStateProps> = ({
    icon,
    title,
    body,
    action,
    variant = "page",
}) => (
    <div className={`tab-empty tab-empty--${variant}`}>
        {icon && (
            <div className="tab-empty-icon">
                <IonIcon icon={icon} />
            </div>
        )}
        <IonText>
            {title && <h2 className="tab-empty-title">{title}</h2>}
            <p className="tab-empty-body">{body}</p>
        </IonText>
        {action}
    </div>
);

export default TabEmptyState;

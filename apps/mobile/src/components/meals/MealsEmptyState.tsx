import { IonIcon, IonText } from "@ionic/react";

import "./MealsEmptyState.scss";

interface MealsEmptyStateProps {
    /** Ionicon shown in the circular badge. Omit for a bare message (e.g. "no search results"). */
    icon?: string;
    title?: string;
    body: React.ReactNode;
    /** Optional call to action rendered below the copy. */
    action?: React.ReactNode;
}

const MealsEmptyState: React.FC<MealsEmptyStateProps> = ({ icon, title, body, action }) => (
    <div className="meals-empty">
        {icon && (
            <div className="meals-empty-icon">
                <IonIcon icon={icon} />
            </div>
        )}
        <IonText>
            {title && <h2 className="meals-empty-title">{title}</h2>}
            <p className="meals-empty-body">{body}</p>
        </IonText>
        {action}
    </div>
);

export default MealsEmptyState;

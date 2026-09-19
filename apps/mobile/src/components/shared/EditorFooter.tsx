import { IonFooter, IonIcon, IonToolbar } from "@ionic/react";
import { arrowBackOutline } from "ionicons/icons";
import { ReactNode } from "react";

type EditorFooterProps = {
    /** The primary action(s), usually one `IonButton expand="block" className="editor-form__submit"`. */
    children: ReactNode;
    /** When given, a 48px back square precedes the actions. */
    onBack?: () => void;
    backLabel?: string;
    backDisabled?: boolean;
    className?: string;
};

/**
 * A modal's footer on the form system: the toolbar on the 16px gutter, an optional back square
 * in the field frame, then the primary action filling the rest. Geometry lives in
 * theme/forms.scss (.editor-footer).
 */
export const EditorFooter: React.FC<EditorFooterProps> = ({
    children,
    onBack,
    backLabel = "Back",
    backDisabled,
    className,
}) => (
    <IonFooter className={className ? `editor-footer ${className}` : "editor-footer"}>
        <IonToolbar>
            <div className="editor-footer__row">
                {onBack && (
                    <button
                        type="button"
                        className="editor-footer__back"
                        onClick={onBack}
                        disabled={backDisabled}
                        aria-label={backLabel}
                    >
                        <IonIcon icon={arrowBackOutline} aria-hidden="true" />
                    </button>
                )}
                {children}
            </div>
        </IonToolbar>
    </IonFooter>
);

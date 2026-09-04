import { IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonNote } from "@ionic/react";
import { checkmarkCircle, ellipseOutline } from "ionicons/icons";
import { useEffect } from "react";
import { useStoreTemplates } from "../../db/hooks";
import { SkeletonListItem } from "../shared/skeleton/SkeletonListItem";

interface StoreTemplatePickerProps {
    /** Selected template id, or undefined while the catalog is still loading. */
    value: string | undefined;
    onChange: (templateId: string) => void;
}

/** Placeholder rows while the catalog loads, shaped like the real ones (title + subtitle). */
const StoreTemplatePickerSkeleton: React.FC = () => (
    <>
        {[0, 1].map((index) => (
            <SkeletonListItem
                key={index}
                widths={["45%", "80%"]}
                startSlot={<IonIcon icon={ellipseOutline} color="medium" />}
            />
        ))}
    </>
);

/**
 * Starting-layout chooser for the New Store form.
 *
 * The catalog comes from the server (`GET /api/stores/templates`), so nothing here is
 * hardcoded — new store types appear without a client release. If the catalog can't be
 * loaded the picker renders nothing and the caller submits without a template, which the
 * server treats as a blank store: the behavior before templates existed.
 */
const StoreTemplatePicker: React.FC<StoreTemplatePickerProps> = ({ value, onChange }) => {
    const { data: templates, isLoading, isError } = useStoreTemplates();

    // Default to the first template the server offers (blank) once the catalog arrives.
    useEffect(() => {
        if (!value && templates && templates.length > 0) {
            onChange(templates[0].id);
        }
    }, [value, templates, onChange]);

    if (isError || (templates && templates.length === 0)) {
        return null;
    }

    return (
        <IonList lines="full" className="store-template-picker">
            <IonListHeader>
                <IonLabel>Starting Layout</IonLabel>
            </IonListHeader>
            {isLoading || !templates ? (
                <StoreTemplatePickerSkeleton />
            ) : (
                templates.map((template) => {
                    const isSelected = template.id === value;
                    return (
                        <IonItem
                            key={template.id}
                            button
                            detail={false}
                            onClick={() => onChange(template.id)}
                            aria-selected={isSelected}
                        >
                            <IonIcon
                                slot="start"
                                icon={isSelected ? checkmarkCircle : ellipseOutline}
                                color={isSelected ? "primary" : "medium"}
                            />
                            <IonLabel className="ion-text-wrap">
                                <h3>{template.label}</h3>
                                <p>{template.description}</p>
                            </IonLabel>
                            {template.aisleCount > 0 && (
                                <IonNote slot="end">
                                    {template.aisleCount} aisles
                                    {template.sectionCount > 0 &&
                                        ` · ${template.sectionCount} sections`}
                                </IonNote>
                            )}
                        </IonItem>
                    );
                })
            )}
        </IonList>
    );
};

export default StoreTemplatePicker;

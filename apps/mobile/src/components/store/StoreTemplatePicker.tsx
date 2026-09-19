import { IonIcon, IonSkeletonText } from "@ionic/react";
import { ellipseOutline } from "ionicons/icons";
import { useEffect } from "react";
import { useStoreTemplates } from "../../db/hooks";
import { FormField } from "../shared/FormField";
import StoreChoice from "./StoreChoice";

import "./StoreSheets.scss";

type StoreTemplatePickerProps = {
    /** Selected template id, or undefined while the catalog is still loading. */
    value: string | undefined;
    onChange: (templateId: string) => void;
};

/** Placeholder rows while the catalog loads, shaped like the real ones (title + subtitle). */
const StoreTemplatePickerSkeleton: React.FC = () => (
    <>
        {[0, 1].map((index) => (
            <div key={index} className="store-choice" aria-hidden="true">
                <IonIcon className="store-choice__mark" icon={ellipseOutline} />
                <span className="store-choice__text">
                    <IonSkeletonText animated className="store-choice__skeleton" />
                    <IonSkeletonText animated className="store-choice__skeleton" />
                </span>
            </div>
        ))}
    </>
);

/**
 * Starting-layout chooser for the New Store form: a field whose box is a radio list.
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
        <FormField label="Starting layout">
            <div className="boxed-list" role="radiogroup" aria-label="Starting layout">
                {isLoading || !templates ? (
                    <StoreTemplatePickerSkeleton />
                ) : (
                    templates.map((template) => (
                        <StoreChoice
                            key={template.id}
                            title={template.label}
                            description={template.description}
                            meta={
                                template.aisleCount > 0 && (
                                    <>
                                        {template.aisleCount} aisles
                                        {template.sectionCount > 0 &&
                                            ` · ${template.sectionCount} sections`}
                                    </>
                                )
                            }
                            selected={template.id === value}
                            onSelect={() => onChange(template.id)}
                        />
                    ))
                )}
            </div>
        </FormField>
    );
};

export default StoreTemplatePicker;

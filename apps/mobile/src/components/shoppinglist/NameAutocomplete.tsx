import { IonInput, IonItem, IonLabel, IonList, IonText } from "@ionic/react";
import { useCallback, useEffect, useState } from "react";
import { Controller } from "react-hook-form";
import { useDebounce } from "use-debounce";
import { useStoreItemAutocomplete } from "../../db/hooks";
import type { AutocompleteItem } from "./itemEditorSchema";
import { useItemEditorContext } from "./useItemEditorContext";

export const NameAutocomplete: React.FC = () => {
    const { control, errors, setValue, storeId, aisles, sections, watch } = useItemEditorContext();

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
    const { data: autocompleteResults } = useStoreItemAutocomplete(storeId, debouncedSearchTerm);
    const [showAutocomplete, setShowAutocomplete] = useState(false);

    // Sync searchTerm with form value (important for editing existing items)
    const nameValue = watch("name");
    useEffect(() => {
        if (nameValue !== searchTerm) {
            setSearchTerm(nameValue || "");
        }
    }, [nameValue, searchTerm]);

    const handleSearchChange = useCallback(
        (value: string) => {
            setSearchTerm(value);
            setValue("name", value, { shouldValidate: true });
            setShowAutocomplete(value.length > 2);
        },
        [setValue]
    );

    const handleAutocompleteSelect = useCallback(
        (item: AutocompleteItem) => {
            setValue("name", item.name, { shouldValidate: true });
            setValue("sectionId", item.sectionId, { shouldValidate: true });

            // If section is present, use section->aisle mapping to ensure consistency
            // Otherwise, use the store item's aisleId
            if (item.sectionId && sections) {
                const section = sections.find((s) => s.id === item.sectionId);
                if (section) {
                    setValue("aisleId", section.aisleId, {
                        shouldValidate: true,
                    });
                }
            } else if (item.aisleId) {
                setValue("aisleId", item.aisleId, { shouldValidate: true });
            }

            setSearchTerm(item.name);
            setShowAutocomplete(false);
        },
        [setValue, sections]
    );

    return (
        <Controller
            name="name"
            control={control}
            render={() => (
                <div style={{ position: "relative" }}>
                    <IonItem>
                        <IonLabel position="stacked">Item</IonLabel>
                        <IonInput
                            value={searchTerm}
                            placeholder="Enter item name"
                            onIonInput={(e) => handleSearchChange(e.detail.value || "")}
                            onIonFocus={() => setShowAutocomplete(searchTerm.length >= 2)}
                            autocapitalize="sentences"
                        />
                    </IonItem>
                    {errors.name && (
                        <IonText color="danger">
                            <p
                                style={{
                                    fontSize: "12px",
                                    marginLeft: "16px",
                                }}
                            >
                                {errors.name.message}
                            </p>
                        </IonText>
                    )}

                    {/* Autocomplete dropdown */}
                    {showAutocomplete && autocompleteResults && autocompleteResults.length > 0 && (
                        <IonList
                            style={{
                                position: "absolute",
                                top: "100%",
                                left: 0,
                                right: 0,
                                zIndex: 1000,
                                maxHeight: "200px",
                                overflow: "auto",
                                border: "1px solid var(--ion-color-medium)",
                                borderRadius: "4px",
                                backgroundColor: "var(--ion-background-color)",
                            }}
                        >
                            {autocompleteResults.map((item) => {
                                const section = sections?.find((s) => s.id === item.sectionId);
                                const aisle = aisles?.find((a) => a.id === section?.aisleId);
                                return (
                                    <IonItem
                                        key={item.id}
                                        button
                                        onClick={() => handleAutocompleteSelect(item)}
                                    >
                                        <IonLabel>
                                            <h3>{item.name}</h3>
                                            {(aisle || section) && (
                                                <p>
                                                    {aisle?.name}
                                                    {aisle && section && " • "}
                                                    {section?.name}
                                                </p>
                                            )}
                                        </IonLabel>
                                    </IonItem>
                                );
                            })}
                        </IonList>
                    )}
                </div>
            )}
        />
    );
};

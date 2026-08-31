import type { StoreItem } from "@basket-bot/core";
import { IonIcon, IonInput, IonItem, IonLabel, IonList, IonText } from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller } from "react-hook-form";
import { useDebounce } from "use-debounce";
import { useStoreItemAutocomplete } from "../../db/hooks";
import { useItemEditorContext } from "./useItemEditorContext";

export const NameAutocomplete: React.FC = () => {
    const { control, errors, setValue, storeId, aisles, sections, watch } = useItemEditorContext();

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
    const { data: autocompleteResults } = useStoreItemAutocomplete(storeId, debouncedSearchTerm);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Sync searchTerm with form value (important for editing existing items)
    const nameValue = watch("name");
    useEffect(() => {
        if (nameValue !== searchTerm) {
            setSearchTerm(nameValue || "");
        }
    }, [nameValue, searchTerm]);

    // Click/tap outside the field or dropdown dismisses it
    useEffect(() => {
        if (!showAutocomplete) return;

        const handleOutsideClick = (event: PointerEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowAutocomplete(false);
                setDismissed(true);
            }
        };

        document.addEventListener("pointerdown", handleOutsideClick);
        return () => document.removeEventListener("pointerdown", handleOutsideClick);
    }, [showAutocomplete]);

    const handleSearchChange = useCallback(
        (value: string) => {
            setSearchTerm(value);
            setValue("name", value, { shouldValidate: true });
            if (value.length <= 2) {
                setDismissed(false);
            }
            setShowAutocomplete(!dismissed && value.length > 2);
        },
        [setValue, dismissed]
    );

    const handleDismiss = useCallback(() => {
        setShowAutocomplete(false);
        setDismissed(true);
    }, []);

    const handleAutocompleteSelect = useCallback(
        (item: StoreItem) => {
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
            setDismissed(false);
        },
        [setValue, sections]
    );

    return (
        <Controller
            name="name"
            control={control}
            render={() => (
                <div ref={containerRef} style={{ position: "relative" }}>
                    <IonItem>
                        <IonLabel position="stacked">Item</IonLabel>
                        <IonInput
                            value={searchTerm}
                            placeholder="Enter item name"
                            onIonInput={(e) => handleSearchChange(e.detail.value || "")}
                            onIonFocus={() => {
                                setDismissed(false);
                                setShowAutocomplete(searchTerm.length >= 2);
                            }}
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
                                paddingTop: 0,
                                paddingBottom: 0,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "2px 12px",
                                    borderBottom: "1px solid var(--ion-color-medium)",
                                }}
                            >
                                <span
                                    style={{ fontSize: "11px", color: "var(--ion-color-medium)" }}
                                >
                                    Suggestions
                                </span>
                                <span
                                    onClick={handleDismiss}
                                    role="button"
                                    aria-label="Dismiss suggestions"
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: "20px",
                                        height: "20px",
                                        flexShrink: 0,
                                        cursor: "pointer",
                                    }}
                                >
                                    <IonIcon icon={closeOutline} style={{ fontSize: "16px" }} />
                                </span>
                            </div>
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

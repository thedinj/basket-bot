import type { StoreAisle, StoreSection } from "@basket-bot/core";
import { IonAlert } from "@ionic/react";
import { useMemo, useState } from "react";
import {
    Control,
    Controller,
    FieldValues,
    Path,
    PathValue,
    UseFormSetValue,
    UseFormWatch,
} from "react-hook-form";
import { useStoreAisles, useStoreSections } from "../../db/hooks";
import { useToast } from "../../hooks/useToast";
import { useAutoCategorize } from "../../llm/features/useAutoCategorize";
import { LLMButton } from "../../llm/shared";
import { naturalSort } from "../../utils/stringUtils";
import { ClickableSelectionField } from "./ClickableSelectionField";
import type { SelectableItem } from "./ClickableSelectionModal";

interface LocationSelectorsProps<T extends FieldValues = FieldValues> {
    control: Control<T>;
    setValue: UseFormSetValue<T>;
    watch: UseFormWatch<T>;
    storeId: string;
    disabled?: boolean;
    itemName?: string;
}

export function LocationSelectors<T extends FieldValues = FieldValues>({
    control,
    setValue,
    watch,
    storeId,
    disabled = false,
    itemName,
}: LocationSelectorsProps<T>) {
    const { data: aisles } = useStoreAisles(storeId);
    const { data: sections } = useStoreSections(storeId);

    const [showOverrideAlert, setShowOverrideAlert] = useState(false);

    const { showError, showSuccess } = useToast();
    const autoCategorize = useAutoCategorize();

    const currentAisleId = watch("aisleId" as Path<T>);
    const currentSectionId = watch("sectionId" as Path<T>);

    // Filter and sort sections by selected aisle, then alphabetically
    const filteredSections = useMemo(() => {
        // Use objectSortFn for natural sorting by section name
        // Import objectSortFn from utils/stringUtils if not already
        return sections
            ?.filter(
                (section: StoreSection) => !currentAisleId || section.aisleId === currentAisleId
            )
            .sort(naturalSort((section: StoreSection) => section.name));
    }, [sections, currentAisleId]);

    // Sort aisles alphabetically
    const sortedAisles = useMemo(() => {
        return aisles?.slice().sort(naturalSort((aisle: StoreAisle) => aisle.name));
    }, [aisles]);

    // Convert to SelectableItem format
    const aisleItems: SelectableItem[] = useMemo(() => {
        return (
            sortedAisles?.map((aisle) => ({
                id: aisle.id,
                label: aisle.name,
            })) || []
        );
    }, [sortedAisles]);

    const sectionItems: SelectableItem[] = useMemo(() => {
        return (
            filteredSections?.map((section) => ({
                id: section.id,
                label: section.name,
            })) || []
        );
    }, [filteredSections]);

    const handleAutoCategorize = async (force = false) => {
        if (!itemName?.trim()) {
            showError("Please enter an item name first");
            return;
        }

        // Check if values already exist and we're not forcing
        if (!force && (currentAisleId || currentSectionId)) {
            setShowOverrideAlert(true);
            return;
        }

        try {
            const result = await autoCategorize({
                itemName,
                aisles:
                    sortedAisles?.map((aisle) => ({
                        id: aisle.id,
                        name: aisle.name,
                        sections: sections?.filter((s) => s.aisleId === aisle.id) || [],
                    })) || [],
            });

            // Apply categorization
            setValue("aisleId" as Path<T>, result.aisleId as PathValue<T, Path<T>>);
            if (result.sectionId) {
                setValue("sectionId" as Path<T>, result.sectionId as PathValue<T, Path<T>>);
            }

            showSuccess(
                `Auto-categorized to ${result.aisleName}${
                    result.sectionName ? ` • ${result.sectionName}` : ""
                }`
            );
        } catch (error) {
            showError(error instanceof Error ? error.message : "Auto-categorize failed");
        }
    };

    return (
        <>
            {/* Override Alert */}
            <IonAlert
                isOpen={showOverrideAlert}
                onDidDismiss={() => setShowOverrideAlert(false)}
                header="Override Location?"
                message="This item already has an aisle/section selected. Do you want to override it with the AI suggestion?"
                buttons={[
                    {
                        text: "Cancel",
                        role: "cancel",
                    },
                    {
                        text: "Override",
                        handler: () => handleAutoCategorize(true),
                    },
                ]}
            />

            {/* Aisle & Section Fields with Auto-Locate Button */}
            <div
                style={{
                    display: "flex",
                    gap: 0,
                    alignItems: "stretch",
                }}
            >
                {/* Fields Column */}
                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {/* Aisle */}
                    <Controller
                        name={"aisleId" as Path<T>}
                        control={control}
                        render={({ field }) => (
                            <ClickableSelectionField
                                items={aisleItems}
                                value={field.value}
                                onSelect={(aisleId) => {
                                    field.onChange(aisleId);
                                    // Clear section if aisle changed and section doesn't belong to new aisle
                                    if (currentSectionId) {
                                        const section = sections?.find(
                                            (s: StoreSection) => s.id === currentSectionId
                                        );
                                        if (section && section.aisleId !== aisleId) {
                                            setValue(
                                                "sectionId" as Path<T>,
                                                null as PathValue<T, Path<T>>
                                            );
                                        }
                                    }
                                }}
                                label="Aisle"
                                placeholder="None"
                                modalTitle="Select Aisle"
                                showSearch={true}
                                searchPlaceholder="Search aisles..."
                                disabled={disabled}
                            />
                        )}
                    />

                    {/* Section */}
                    <Controller
                        name={"sectionId" as Path<T>}
                        control={control}
                        render={({ field }) => (
                            <ClickableSelectionField
                                items={sectionItems}
                                value={field.value}
                                onSelect={(sectionId) => {
                                    field.onChange(sectionId);
                                    // If a section is selected, automatically set its aisle
                                    if (sectionId && sections) {
                                        const section = sections.find(
                                            (s: StoreSection) => s.id === sectionId
                                        );
                                        if (section) {
                                            setValue(
                                                "aisleId" as Path<T>,
                                                section.aisleId as PathValue<T, Path<T>>
                                            );
                                        }
                                    }
                                }}
                                label="Section"
                                placeholder="None"
                                modalTitle="Select Section"
                                showSearch={true}
                                searchPlaceholder="Search sections..."
                                disabled={disabled}
                            />
                        )}
                    />
                </div>

                {/* Auto-Locate Icon Button */}
                <div style={{ display: "flex", alignItems: "stretch" }}>
                    <LLMButton
                        iconOnly
                        onClick={() => handleAutoCategorize()}
                        disabled={
                            disabled || !itemName || !sortedAisles || sortedAisles.length === 0
                        }
                        title="Auto-Locate"
                    />
                </div>
            </div>
        </>
    );
}

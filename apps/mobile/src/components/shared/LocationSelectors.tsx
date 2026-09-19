import type { StoreSection } from "@basket-bot/core";
import { IonAlert, IonIcon } from "@ionic/react";
import clsx from "clsx";
import { chevronForward, closeCircle } from "ionicons/icons";
import { Suspense, useEffect, useRef, useState } from "react";
import {
    Control,
    FieldValues,
    Path,
    PathValue,
    UseFormSetValue,
    UseFormWatch,
    useController,
} from "react-hook-form";
import { useStoreAisles, useStoreItems, useStoreSections } from "../../db/hooks";
import { useToast } from "../../hooks/useToast";
import { SUGGEST_MERGE_CONFIDENCE, type DuplicateMatch } from "../../llm/features/itemDedupe";
import { useAutoCategorize } from "../../llm/features/useAutoCategorize";
import { LLM_ICON_SRC } from "../../llm/shared/constants";
import AislesSectionsManagementModal from "../store/AislesSectionsManagementModal";
import { FormField } from "./FormField";
import { LocationPicker } from "./LocationPicker";
import "./LocationSelectors.css";

// How long the "just auto-located" shimmer plays on the aisle/section chips.
const AUTO_LOCATE_SHIMMER_MS = 2200;

interface LocationSelectorsProps<T extends FieldValues = FieldValues> {
    control: Control<T>;
    setValue: UseFormSetValue<T>;
    watch: UseFormWatch<T>;
    storeId: string;
    disabled?: boolean;
    itemName?: string;
    /**
     * What "Use existing" does when Auto-Locate finds this item already exists under another
     * wording. The default renames the form's name field onto the existing item's name, which
     * is what every save path that goes through `updateItem`/`getOrCreateStoreItem` needs — the
     * backend then merges or reuses. Supply this only where that is not the save path.
     */
    onUseExistingItem?: (match: DuplicateMatch) => void;
}

export function LocationSelectors<T extends FieldValues = FieldValues>(
    props: LocationSelectorsProps<T>
) {
    const { control, setValue, storeId, disabled = false, itemName, onUseExistingItem } = props;

    const { data: aisles } = useStoreAisles(storeId);
    const { data: sections } = useStoreSections(storeId);
    const { data: storeItems } = useStoreItems(storeId);

    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [isManageOpen, setIsManageOpen] = useState(false);
    const [justAutoLocated, setJustAutoLocated] = useState(false);
    const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicateMatch | null>(null);
    const shimmerTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => () => clearTimeout(shimmerTimeoutRef.current), []);

    const { showError, showSuccess } = useToast();
    const autoCategorize = useAutoCategorize();

    const { field: aisleField } = useController({ name: "aisleId" as Path<T>, control });
    const { field: sectionField } = useController({ name: "sectionId" as Path<T>, control });

    const currentAisleId = aisleField.value as string | null | undefined;
    const currentSectionId = sectionField.value as string | null | undefined;

    // Per the normalization rule, an item with a section stores aisleId as NULL
    // (the section's aisle is authoritative). Derive the aisle here so the picker
    // still expands/scrolls to the right aisle on open for that common case.
    const effectiveAisleId =
        currentAisleId ??
        sections?.find((s: StoreSection) => s.id === currentSectionId)?.aisleId ??
        null;

    const currentAisle = aisles?.find((a) => a.id === currentAisleId);
    const currentSection = sections?.find((s: StoreSection) => s.id === currentSectionId);

    const setLocation = (aisleId: string | null, sectionId: string | null) => {
        setValue("aisleId" as Path<T>, aisleId as PathValue<T, Path<T>>, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
        });
        setValue("sectionId" as Path<T>, sectionId as PathValue<T, Path<T>>, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
        });
    };

    // Only offered while nothing is set — the chip that triggers this is hidden once
    // an aisle/section is chosen, so there's no override-existing-value case to handle.
    const handleAutoCategorize = async () => {
        if (!itemName?.trim()) {
            showError("Please enter an item name first");
            return;
        }

        try {
            const result = await autoCategorize({
                itemName,
                fullAisles: aisles ?? [],
                fullSections: sections || [],
                existingItems: storeItems,
            });

            setLocation(result.aisleId, result.sectionId);

            clearTimeout(shimmerTimeoutRef.current);
            setJustAutoLocated(true);
            shimmerTimeoutRef.current = setTimeout(() => {
                setJustAutoLocated(false);
            }, AUTO_LOCATE_SHIMMER_MS);

            // Never merge behind the user's back in this flow — they are looking at the form.
            if (
                result.duplicateOf &&
                result.duplicateOf.confidence >= SUGGEST_MERGE_CONFIDENCE &&
                result.duplicateOf.existing.name !== itemName
            ) {
                setDuplicatePrompt(result.duplicateOf);
                return;
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

    const applyExistingItem = (match: DuplicateMatch) => {
        if (onUseExistingItem) {
            onUseExistingItem(match);
            return;
        }

        // The existing item's *exact* name, not the model's preferred wording: matching its
        // `nameNorm` is what makes the save reuse or merge into that row rather than add another.
        setValue("name" as Path<T>, match.existing.name as PathValue<T, Path<T>>, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
        });
    };

    const hasLocation = Boolean(currentAisle || currentSection);

    return (
        <>
            {/* One box, tapped to open the picker: "Aisle › Section" once set, with a clear
                button; Auto-Locate rides on the label line while nothing is set. */}
            <FormField
                label="Location"
                action={
                    !hasLocation && (
                        <button
                            type="button"
                            className="form-field__action"
                            disabled={disabled || !itemName || (aisles?.length ?? 0) === 0}
                            onClick={handleAutoCategorize}
                            title="Auto-Locate: guess the aisle/section from the item name"
                        >
                            <IonIcon src={LLM_ICON_SRC} aria-hidden="true" />
                            Auto-Locate
                        </button>
                    )
                }
            >
                <button
                    type="button"
                    className={clsx(
                        "form-control",
                        "form-control--button",
                        justAutoLocated && "location-chip--newly-located"
                    )}
                    disabled={disabled}
                    onClick={() => setIsPickerOpen(true)}
                >
                    <span className="form-control__value">
                        {hasLocation ? (
                            <>
                                {currentAisle?.name}
                                {currentAisle && currentSection && (
                                    <span className="location-value__sep"> › </span>
                                )}
                                {currentSection?.name}
                            </>
                        ) : (
                            <span className="form-control__placeholder">Not set</span>
                        )}
                    </span>
                    {hasLocation && !disabled ? (
                        <span
                            role="button"
                            tabIndex={0}
                            className="form-control__icon-button form-control__icon-button--end"
                            aria-label="Clear location"
                            onClick={(e) => {
                                e.stopPropagation();
                                setLocation(null, null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setLocation(null, null);
                                }
                            }}
                        >
                            <IonIcon icon={closeCircle} />
                        </span>
                    ) : (
                        <IonIcon
                            icon={chevronForward}
                            className="form-control__trail"
                            aria-hidden="true"
                        />
                    )}
                </button>
            </FormField>
            <Suspense fallback={null}>
                <LocationPicker
                    isOpen={isPickerOpen}
                    onDismiss={() => setIsPickerOpen(false)}
                    aisles={aisles ?? []}
                    sections={sections ?? []}
                    currentAisleId={effectiveAisleId}
                    currentSectionId={currentSectionId}
                    onSelect={setLocation}
                    onManageAisles={() => {
                        setIsPickerOpen(false);
                        setIsManageOpen(true);
                    }}
                />
            </Suspense>

            <AislesSectionsManagementModal
                isOpen={isManageOpen}
                onClose={() => setIsManageOpen(false)}
                storeId={storeId}
            />

            <IonAlert
                isOpen={duplicatePrompt !== null}
                onDidDismiss={() => setDuplicatePrompt(null)}
                header="Possible duplicate"
                message={
                    duplicatePrompt
                        ? `"${duplicatePrompt.existing.name}" is already filed here. Shall I record "${itemName}" as the same item?`
                        : ""
                }
                buttons={[
                    {
                        text: "Keep separate",
                        role: "cancel",
                    },
                    {
                        text: "Use existing",
                        handler: () => {
                            if (duplicatePrompt) applyExistingItem(duplicatePrompt);
                        },
                    },
                ]}
            />
        </>
    );
}

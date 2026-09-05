import type { StoreSection } from "@basket-bot/core";
import { IonChip, IonIcon, IonLabel } from "@ionic/react";
import clsx from "clsx";
import { closeCircle } from "ionicons/icons";
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
import { useStoreAisles, useStoreSections } from "../../db/hooks";
import { useToast } from "../../hooks/useToast";
import { useAutoCategorize } from "../../llm/features/useAutoCategorize";
import { LLM_COLOR, LLM_ICON_SRC } from "../../llm/shared/constants";
import AislesSectionsManagementModal from "../store/AislesSectionsManagementModal";
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
}

export function LocationSelectors<T extends FieldValues = FieldValues>(
    props: LocationSelectorsProps<T>
) {
    const { control, setValue, storeId, disabled = false, itemName } = props;

    const { data: aisles } = useStoreAisles(storeId);
    const { data: sections } = useStoreSections(storeId);

    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [isManageOpen, setIsManageOpen] = useState(false);
    const [justAutoLocated, setJustAutoLocated] = useState(false);
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
            });

            setLocation(result.aisleId, result.sectionId);

            clearTimeout(shimmerTimeoutRef.current);
            setJustAutoLocated(true);
            shimmerTimeoutRef.current = setTimeout(() => {
                setJustAutoLocated(false);
            }, AUTO_LOCATE_SHIMMER_MS);

            showSuccess(
                `Auto-categorized to ${result.aisleName}${
                    result.sectionName ? ` • ${result.sectionName}` : ""
                }`
            );
        } catch (error) {
            showError(error instanceof Error ? error.message : "Auto-categorize failed");
        }
    };

    const hasLocation = Boolean(currentAisle || currentSection);

    return (
        <>
            {/* Location row: chips, with Auto-Locate folded in as one of them */}
            <div
                style={{
                    padding: "8px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                }}
                onClick={() => !disabled && setIsPickerOpen(true)}
            >
                <div style={{ fontSize: "0.75rem", color: "var(--ion-color-medium)" }}>
                    Location
                </div>
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "6px",
                        cursor: disabled ? "default" : "pointer",
                    }}
                >
                    {!hasLocation ? (
                        <span
                            style={{
                                color: disabled
                                    ? "var(--ion-color-medium)"
                                    : "var(--ion-color-primary)",
                                textDecoration: disabled ? "none" : "underline",
                                fontSize: "0.95rem",
                            }}
                        >
                            Set location
                        </span>
                    ) : (
                        <>
                            {currentAisle && (
                                <IonChip
                                    disabled={disabled}
                                    outline
                                    className={clsx(
                                        justAutoLocated && "location-chip--newly-located"
                                    )}
                                >
                                    <IonLabel>{currentAisle.name}</IonLabel>
                                    {!disabled && (
                                        <IonIcon
                                            icon={closeCircle}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setLocation(null, null);
                                            }}
                                        />
                                    )}
                                </IonChip>
                            )}
                            {currentSection && (
                                <IonChip
                                    disabled={disabled}
                                    outline
                                    className={clsx(
                                        justAutoLocated && "location-chip--newly-located"
                                    )}
                                >
                                    <IonLabel>{currentSection.name}</IonLabel>
                                    {!disabled && (
                                        <IonIcon
                                            icon={closeCircle}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setLocation(currentAisleId ?? null, null);
                                            }}
                                        />
                                    )}
                                </IonChip>
                            )}
                        </>
                    )}

                    {!hasLocation && (
                        <IonChip
                            outline
                            disabled={disabled || !itemName || (aisles?.length ?? 0) === 0}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAutoCategorize();
                            }}
                            title="Auto-Locate: guess the aisle/section from the item name"
                            style={{
                                "--color": LLM_COLOR,
                                borderColor: LLM_COLOR,
                            }}
                        >
                            <IonIcon src={LLM_ICON_SRC} style={{ fontSize: "16px" }} />
                            <IonLabel>Auto-Locate</IonLabel>
                        </IonChip>
                    )}
                </div>
            </div>

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
        </>
    );
}

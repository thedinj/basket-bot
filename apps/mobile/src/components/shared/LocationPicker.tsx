import type { StoreAisle, StoreSection } from "@basket-bot/core";
import {
    IonAccordion,
    IonAccordionGroup,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonSearchbar,
    IonText,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { checkmarkOutline, chevronDownOutline, closeOutline } from "ionicons/icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { naturalSort, normalizeItemName } from "../../utils/stringUtils";
import "./LocationPicker.scss";

interface LocationPickerProps {
    isOpen: boolean;
    onDismiss: () => void;
    aisles: StoreAisle[];
    sections: StoreSection[];
    currentAisleId?: string | null;
    currentSectionId?: string | null;
    onSelect: (aisleId: string | null, sectionId: string | null) => void;
    onManageAisles: () => void;
}

type SearchEntry =
    | { kind: "aisle"; id: string; label: string; aisle: StoreAisle }
    | { kind: "section"; id: string; label: string; subtitle: string; section: StoreSection };

const rankSearchEntries = (entries: SearchEntry[], searchText: string): SearchEntry[] => {
    const lowerSearch = normalizeItemName(searchText);
    const tiered: Array<{ entry: SearchEntry; tier: number }> = [];

    entries.forEach((entry) => {
        const lowerLabel = entry.label.toLowerCase();
        if (lowerLabel.startsWith(lowerSearch)) {
            tiered.push({ entry, tier: 1 });
        } else if (lowerLabel.includes(lowerSearch)) {
            tiered.push({ entry, tier: 3 });
        }
    });

    return tiered
        .sort((a, b) => (a.tier !== b.tier ? a.tier - b.tier : a.entry.label.localeCompare(b.entry.label)))
        .map((t) => t.entry);
};

/**
 * Combined aisle + section picker. Aisles with sections expand accordion-style;
 * aisles without sections commit immediately. Search flattens both levels so a
 * section in a different aisle is reachable without clearing the aisle first.
 */
export const LocationPicker: React.FC<LocationPickerProps> = ({
    isOpen,
    onDismiss,
    aisles,
    sections,
    currentAisleId,
    currentSectionId,
    onSelect,
    onManageAisles,
}) => {
    const [searchText, setSearchText] = useState("");
    const [expandedAisleId, setExpandedAisleId] = useState<string | undefined>(undefined);
    const aisleRefs = useRef(new Map<string, HTMLElement>());

    useEffect(() => {
        if (isOpen) {
            setSearchText("");
            setExpandedAisleId(currentAisleId ?? undefined);
        }
    }, [isOpen, currentAisleId]);

    // Scrolls the expanded aisle into view once the browse list is mounted —
    // covers both initial open and drilling in from a search result (the browse
    // list, and its refs, don't exist yet while search results are showing).
    // "start" (not "center") so the aisle's own header lands at the top of the
    // viewport instead of the midpoint shifting as its section list expands.
    // Deferred a frame: right after switching from search back to the browse
    // list, the Ionic accordion/list custom elements have just mounted and
    // haven't finished their initial layout, so scrolling on the same tick
    // measures stale (often zero-height) geometry and lands short.
    useEffect(() => {
        if (isOpen && !searchText && expandedAisleId) {
            const target = expandedAisleId;
            const frame = requestAnimationFrame(() => {
                aisleRefs.current.get(target)?.scrollIntoView({ block: "start" });
            });
            return () => cancelAnimationFrame(frame);
        }
    }, [isOpen, searchText, expandedAisleId]);

    const sortedAisles = useMemo(() => aisles.slice().sort(naturalSort((a) => a.name)), [aisles]);

    const sectionsByAisle = useMemo(() => {
        const map = new Map<string, StoreSection[]>();
        sections.forEach((section) => {
            const list = map.get(section.aisleId) ?? [];
            list.push(section);
            map.set(section.aisleId, list);
        });
        map.forEach((list) => list.sort(naturalSort((s) => s.name)));
        return map;
    }, [sections]);

    const handleDismiss = useCallback(() => {
        setSearchText("");
        onDismiss();
    }, [onDismiss]);

    const commit = useCallback(
        (aisleId: string | null, sectionId: string | null) => {
            onSelect(aisleId, sectionId);
            setSearchText("");
            onDismiss();
        },
        [onSelect, onDismiss]
    );

    const selectAisleOnly = useCallback(
        (aisle: StoreAisle) => {
            const keepSection =
                currentSectionId &&
                sections.find((s) => s.id === currentSectionId)?.aisleId === aisle.id;
            commit(aisle.id, keepSection ? currentSectionId! : null);
        },
        [commit, currentSectionId, sections]
    );

    // Tapping an aisle result: if it has sections, drill in (stage + expand, same as
    // the browse list) rather than committing — matches the "read it off the store
    // directory, then pick a section" flow. A no-sections aisle still commits immediately.
    const handleAisleTap = useCallback(
        (aisle: StoreAisle) => {
            const aisleSections = sectionsByAisle.get(aisle.id) ?? [];
            if (aisleSections.length === 0) {
                selectAisleOnly(aisle);
                return;
            }
            setSearchText("");
            setExpandedAisleId(aisle.id);
        },
        [sectionsByAisle, selectAisleOnly]
    );

    const searchResults = useMemo(() => {
        if (!searchText.trim()) return [];
        const entries: SearchEntry[] = [
            ...sortedAisles.map(
                (aisle): SearchEntry => ({ kind: "aisle", id: aisle.id, label: aisle.name, aisle })
            ),
            ...sections.map((section): SearchEntry => {
                const aisleName = aisles.find((a) => a.id === section.aisleId)?.name ?? "";
                return {
                    kind: "section",
                    id: section.id,
                    label: section.name,
                    subtitle: aisleName,
                    section,
                };
            }),
        ];
        return rankSearchEntries(entries, searchText);
    }, [searchText, sortedAisles, sections, aisles]);

    const handleAccordionChange = (e: CustomEvent<{ value: string | string[] | undefined }>) => {
        const value = e.detail.value;
        setExpandedAisleId(Array.isArray(value) ? value[0] : value);
    };

    const hasSelection = Boolean(currentAisleId || currentSectionId);
    const noAisles = aisles.length === 0;

    return (
        <IonModal isOpen={isOpen} onDidDismiss={handleDismiss}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Set Location</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={handleDismiss}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
                {!noAisles && (
                    <IonToolbar>
                        <IonSearchbar
                            value={searchText}
                            onIonInput={(e) => setSearchText(e.detail.value || "")}
                            placeholder="Search aisles & sections"
                            debounce={300}
                        />
                    </IonToolbar>
                )}
            </IonHeader>
            <IonContent>
                {noAisles ? (
                    <div style={{ padding: "32px 24px", textAlign: "center" }}>
                        <IonText color="medium">
                            <p>No aisles set up for this store</p>
                        </IonText>
                        <IonButton onClick={onManageAisles}>Manage Aisles & Sections</IonButton>
                    </div>
                ) : searchText.trim() ? (
                    <IonList>
                        {searchResults.length === 0 ? (
                            <IonItem>
                                <IonLabel color="medium">No matching aisles or sections</IonLabel>
                            </IonItem>
                        ) : (
                            searchResults.map((entry) =>
                                entry.kind === "aisle" ? (
                                    <IonItem
                                        key={`aisle-${entry.id}`}
                                        button
                                        detail={(sectionsByAisle.get(entry.id) ?? []).length > 0}
                                        detailIcon={chevronDownOutline}
                                        onClick={() => handleAisleTap(entry.aisle)}
                                    >
                                        <IonLabel className="location-picker__aisle-label">
                                            {entry.label}
                                        </IonLabel>
                                        {currentAisleId === entry.id && !currentSectionId && (
                                            <IonIcon icon={checkmarkOutline} slot="end" color="primary" />
                                        )}
                                    </IonItem>
                                ) : (
                                    <IonItem
                                        key={`section-${entry.id}`}
                                        button
                                        detail={false}
                                        className="location-picker__section-item"
                                        onClick={() => commit(entry.section.aisleId, entry.section.id)}
                                    >
                                        <IonLabel className="location-picker__section-label">
                                            {entry.label}
                                            <p className="location-picker__search-subtitle">
                                                {entry.subtitle}
                                            </p>
                                        </IonLabel>
                                        {currentSectionId === entry.id && (
                                            <IonIcon icon={checkmarkOutline} slot="end" color="primary" />
                                        )}
                                    </IonItem>
                                )
                            )
                        )}
                    </IonList>
                ) : (
                    <IonAccordionGroup value={expandedAisleId} onIonChange={handleAccordionChange}>
                        {sortedAisles.map((aisle) => {
                            const aisleSections = sectionsByAisle.get(aisle.id) ?? [];

                            if (aisleSections.length === 0) {
                                return (
                                    <IonItem
                                        key={aisle.id}
                                        button
                                        detail={false}
                                        onClick={() => selectAisleOnly(aisle)}
                                        ref={(el: HTMLIonItemElement | null) => {
                                            if (el) aisleRefs.current.set(aisle.id, el);
                                            else aisleRefs.current.delete(aisle.id);
                                        }}
                                    >
                                        <IonLabel className="location-picker__aisle-label">
                                            {aisle.name}
                                        </IonLabel>
                                        {currentAisleId === aisle.id && (
                                            <IonIcon icon={checkmarkOutline} slot="end" color="primary" />
                                        )}
                                    </IonItem>
                                );
                            }

                            return (
                                <IonAccordion
                                    key={aisle.id}
                                    value={aisle.id}
                                    ref={(el) => {
                                        if (el) aisleRefs.current.set(aisle.id, el);
                                        else aisleRefs.current.delete(aisle.id);
                                    }}
                                >
                                    <IonItem slot="header" detail={false}>
                                        <IonLabel className="location-picker__aisle-label">
                                            {aisle.name}
                                        </IonLabel>
                                        {currentAisleId === aisle.id && !currentSectionId && (
                                            <IonIcon icon={checkmarkOutline} slot="end" color="primary" />
                                        )}
                                    </IonItem>
                                    <IonList slot="content">
                                        <IonItem
                                            button
                                            detail={false}
                                            className="location-picker__no-section-item"
                                            onClick={() => commit(aisle.id, null)}
                                        >
                                            <IonLabel
                                                color="medium"
                                                className="location-picker__no-section-label"
                                            >
                                                - no section -
                                            </IonLabel>
                                            {currentAisleId === aisle.id && !currentSectionId && (
                                                <IonIcon
                                                    icon={checkmarkOutline}
                                                    slot="end"
                                                    color="primary"
                                                />
                                            )}
                                        </IonItem>
                                        {aisleSections.map((section) => (
                                            <IonItem
                                                key={section.id}
                                                button
                                                detail={false}
                                                className="location-picker__section-item"
                                                onClick={() => commit(aisle.id, section.id)}
                                            >
                                                <IonLabel className="location-picker__section-label">
                                                    {section.name}
                                                </IonLabel>
                                                {currentSectionId === section.id && (
                                                    <IonIcon
                                                        icon={checkmarkOutline}
                                                        slot="end"
                                                        color="primary"
                                                    />
                                                )}
                                            </IonItem>
                                        ))}
                                    </IonList>
                                </IonAccordion>
                            );
                        })}
                    </IonAccordionGroup>
                )}
            </IonContent>
            {hasSelection && (
                <IonFooter>
                    <IonToolbar>
                        <IonButton
                            expand="block"
                            fill="clear"
                            color="medium"
                            onClick={() => commit(null, null)}
                        >
                            Clear location
                        </IonButton>
                    </IonToolbar>
                </IonFooter>
            )}
        </IonModal>
    );
};

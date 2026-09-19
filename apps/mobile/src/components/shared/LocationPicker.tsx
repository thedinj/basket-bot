import type { StoreAisle, StoreSection } from "@basket-bot/core";
import {
    IonButton,
    IonContent,
    IonIcon,
    IonLabel,
    IonModal,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
} from "@ionic/react";
import clsx from "clsx";
import { checkmark, chevronDownOutline, chevronForward, mapOutline } from "ionicons/icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AisleSortMode, useAisleSortMode } from "../../hooks/useAisleSortMode";
import { naturalSort, normalizeForSearch } from "../../utils/stringUtils";
import { AislePlate } from "./AislePlate";
import { EditorFooter } from "./EditorFooter";
import { aislePlate } from "./grouping.utils";
import { ModalHeader } from "./ModalHeader";
import TabEmptyState from "./TabEmptyState";

import "./pickerSheet.scss";
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

const rankSearchEntries = (
    entries: SearchEntry[],
    searchText: string,
    compareWithinTier: (a: SearchEntry, b: SearchEntry) => number
): SearchEntry[] => {
    const lowerSearch = normalizeForSearch(searchText);
    const tiered: Array<{ entry: SearchEntry; tier: number }> = [];

    entries.forEach((entry) => {
        // Both sides go through the same normalizer, so a plural search term matches.
        const lowerLabel = normalizeForSearch(entry.label);
        if (lowerLabel.startsWith(lowerSearch)) {
            tiered.push({ entry, tier: 1 });
        } else if (lowerLabel.includes(lowerSearch)) {
            tiered.push({ entry, tier: 3 });
        }
    });

    return tiered
        .sort((a, b) => (a.tier !== b.tier ? a.tier - b.tier : compareWithinTier(a.entry, b.entry)))
        .map((t) => t.entry);
};

// Large enough that no aisle has anywhere near this many sections, so an aisle's
// position in the walk always outweighs its sections' own sortOrder within it.
const STORE_ORDER_AISLE_SCALE = 100_000;

// Same numeric-aware collator as naturalSort, so "Aisle 2" sorts before "Aisle 10"
// in search results just like it does in the browse view.
const compareLabelsNaturally = naturalSort((entry: SearchEntry) => entry.label);

/** The lilac check that marks the location currently set. */
const SelectedCheck: React.FC = () => (
    <IonIcon className="location-picker__check" icon={checkmark} aria-hidden="true" />
);

/**
 * An aisle row's face: the shopping list's own plate and sign-face name ("[AISLE 3]" alone,
 * "[7] Baking", "[🥬] Produce"), then the check and a chevron when there is more inside.
 */
const AisleRowFace: React.FC<{
    aisle: StoreAisle;
    selected: boolean;
    trail?: "expand" | "collapse" | "drill";
}> = ({ aisle, selected, trail }) => {
    const plate = aislePlate({ aisleId: aisle.id, aisleName: aisle.name, aisleEmoji: aisle.emoji });
    return (
        <>
            <AislePlate badge={plate.badge} kind={plate.badgeKind} />
            <span className="location-picker__aisle-name">{plate.label}</span>
            <span className="location-picker__marks">
                {selected && <SelectedCheck />}
                {trail && (
                    <IonIcon
                        className={clsx(
                            "location-picker__chevron",
                            trail === "collapse" && "location-picker__chevron--open"
                        )}
                        icon={trail === "drill" ? chevronForward : chevronDownOutline}
                        aria-hidden="true"
                    />
                )}
            </span>
        </>
    );
};

/**
 * A section option, set in the shopping list's section register: lilac ruled caps in the aisle
 * name's column, the rule running to the check column. A search result names its aisle below.
 */
const SectionOption: React.FC<{
    name: string;
    selected: boolean;
    onSelect: () => void;
    /** The aisle it sits in, for a search result read out of context. */
    aisleName?: string;
    /** The "no section" choice: the same row, quiet. */
    none?: boolean;
}> = ({ name, selected, onSelect, aisleName, none }) => (
    <button
        type="button"
        role="option"
        aria-selected={selected}
        className="row-button location-picker__section"
        onClick={onSelect}
    >
        <span className="location-picker__section-text">
            <span
                className={clsx(
                    "ruled-label",
                    "location-picker__section-label",
                    none && "location-picker__section-label--none"
                )}
            >
                <span className="location-picker__section-name">{name}</span>
            </span>
            {aisleName && <span className="location-picker__section-aisle">In {aisleName}</span>}
        </span>
        <span className="location-picker__marks">{selected && <SelectedCheck />}</span>
    </button>
);

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

    const { sortMode, setSortMode } = useAisleSortMode();

    const sortedAisles = useMemo(
        () =>
            sortMode === "storeOrder" ? aisles : aisles.slice().sort(naturalSort((a) => a.name)),
        [aisles, sortMode]
    );

    const sectionsByAisle = useMemo(() => {
        const map = new Map<string, StoreSection[]>();
        sections.forEach((section) => {
            const list = map.get(section.aisleId) ?? [];
            list.push(section);
            map.set(section.aisleId, list);
        });
        map.forEach((list) =>
            list.sort(
                sortMode === "storeOrder"
                    ? (a, b) => a.sortOrder - b.sortOrder
                    : naturalSort((s) => s.name)
            )
        );
        return map;
    }, [sections, sortMode]);

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

    // Position of each aisle in the store's actual walking order, used to rank
    // search results in "Store Order" mode (independent of the aisle's own naturalSort
    // position, which only applies in "A–Z" mode).
    const aisleOrderIndex = useMemo(() => {
        const map = new Map<string, number>();
        aisles.forEach((aisle, index) => map.set(aisle.id, index));
        return map;
    }, [aisles]);

    const compareSearchEntries = useCallback(
        (a: SearchEntry, b: SearchEntry) => {
            if (sortMode === "alphabetical") {
                return compareLabelsNaturally(a, b);
            }
            const rankOf = (entry: SearchEntry) => {
                if (entry.kind === "aisle") {
                    return (aisleOrderIndex.get(entry.aisle.id) ?? 0) * STORE_ORDER_AISLE_SCALE - 1;
                }
                return (
                    (aisleOrderIndex.get(entry.section.aisleId) ?? 0) * STORE_ORDER_AISLE_SCALE +
                    entry.section.sortOrder
                );
            };
            return rankOf(a) - rankOf(b);
        },
        [sortMode, aisleOrderIndex]
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
        return rankSearchEntries(entries, searchText, compareSearchEntries);
    }, [searchText, sortedAisles, sections, aisles, compareSearchEntries]);

    // One aisle open at a time; tapping the open one folds it again.
    const toggleAisle = (aisleId: string) =>
        setExpandedAisleId((current) => (current === aisleId ? undefined : aisleId));

    const setAisleRef = (aisleId: string) => (el: HTMLLIElement | null) => {
        if (el) aisleRefs.current.set(aisleId, el);
        else aisleRefs.current.delete(aisleId);
    };

    const hasSelection = Boolean(currentAisleId || currentSectionId);
    const noAisles = aisles.length === 0;

    return (
        <IonModal isOpen={isOpen} onDidDismiss={handleDismiss}>
            <ModalHeader title="Set Location" onClose={handleDismiss}>
                {!noAisles && (
                    <div className="picker-header">
                        <IonSearchbar
                            className="search-field"
                            value={searchText}
                            onIonInput={(e) => setSearchText(e.detail.value || "")}
                            placeholder="Search aisles & sections"
                            debounce={300}
                        />
                        <IonSegment
                            className="editor-mode-switch location-picker__modes"
                            value={sortMode}
                            onIonChange={(e) => setSortMode(e.detail.value as AisleSortMode)}
                        >
                            <IonSegmentButton value="alphabetical">
                                <IonLabel>A–Z</IonLabel>
                            </IonSegmentButton>
                            <IonSegmentButton value="storeOrder">
                                <IonLabel>Store Order</IonLabel>
                            </IonSegmentButton>
                        </IonSegment>
                    </div>
                )}
            </ModalHeader>
            <IonContent>
                {noAisles ? (
                    <TabEmptyState
                        variant="full"
                        icon={mapOutline}
                        title="No layout to pick from"
                        body="This store has no aisles yet, so there is nowhere to file this."
                        action={
                            <IonButton onClick={onManageAisles}>Manage Aisles & Sections</IonButton>
                        }
                    />
                ) : searchText.trim() ? (
                    searchResults.length === 0 ? (
                        <p className="picker-empty">No matching aisles or sections</p>
                    ) : (
                        <ul
                            className="location-picker__list"
                            role="listbox"
                            aria-label="Matching aisles and sections"
                        >
                            {searchResults.map((entry) => {
                                if (entry.kind === "aisle") {
                                    const selected =
                                        currentAisleId === entry.id && !currentSectionId;
                                    const hasSections =
                                        (sectionsByAisle.get(entry.id) ?? []).length > 0;
                                    return (
                                        <li key={`aisle-${entry.id}`} role="presentation">
                                            <button
                                                type="button"
                                                role="option"
                                                aria-selected={selected}
                                                className="row-button location-picker__aisle"
                                                onClick={() => handleAisleTap(entry.aisle)}
                                            >
                                                <AisleRowFace
                                                    aisle={entry.aisle}
                                                    selected={selected}
                                                    trail={hasSections ? "drill" : undefined}
                                                />
                                            </button>
                                        </li>
                                    );
                                }
                                return (
                                    <li key={`section-${entry.id}`} role="presentation">
                                        <SectionOption
                                            name={entry.label}
                                            aisleName={entry.subtitle}
                                            selected={currentSectionId === entry.id}
                                            onSelect={() =>
                                                commit(entry.section.aisleId, entry.section.id)
                                            }
                                        />
                                    </li>
                                );
                            })}
                        </ul>
                    )
                ) : (
                    <ul className="location-picker__list">
                        {sortedAisles.map((aisle) => {
                            const aisleSections = sectionsByAisle.get(aisle.id) ?? [];

                            if (aisleSections.length === 0) {
                                const selected = currentAisleId === aisle.id;
                                return (
                                    <li key={aisle.id} ref={setAisleRef(aisle.id)}>
                                        <button
                                            type="button"
                                            className="row-button location-picker__aisle"
                                            aria-current={selected || undefined}
                                            onClick={() => selectAisleOnly(aisle)}
                                        >
                                            <AisleRowFace aisle={aisle} selected={selected} />
                                        </button>
                                    </li>
                                );
                            }

                            const expanded = expandedAisleId === aisle.id;
                            const aisleOnly = currentAisleId === aisle.id && !currentSectionId;
                            const sectionsId = `location-picker-sections-${aisle.id}`;
                            return (
                                <li key={aisle.id} ref={setAisleRef(aisle.id)}>
                                    <button
                                        type="button"
                                        className="row-button location-picker__aisle"
                                        aria-expanded={expanded}
                                        aria-controls={sectionsId}
                                        aria-current={aisleOnly || undefined}
                                        onClick={() => toggleAisle(aisle.id)}
                                    >
                                        <AisleRowFace
                                            aisle={aisle}
                                            selected={aisleOnly}
                                            trail={expanded ? "collapse" : "expand"}
                                        />
                                    </button>
                                    {expanded && (
                                        <ul
                                            id={sectionsId}
                                            className="location-picker__sections"
                                            role="listbox"
                                            aria-label={`Sections in ${aisle.name}`}
                                        >
                                            <li role="presentation">
                                                <SectionOption
                                                    name="No section"
                                                    none
                                                    selected={aisleOnly}
                                                    onSelect={() => commit(aisle.id, null)}
                                                />
                                            </li>
                                            {aisleSections.map((section) => (
                                                <li key={section.id} role="presentation">
                                                    <SectionOption
                                                        name={section.name}
                                                        selected={currentSectionId === section.id}
                                                        onSelect={() =>
                                                            commit(aisle.id, section.id)
                                                        }
                                                    />
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </IonContent>
            {hasSelection && (
                <EditorFooter>
                    <IonButton
                        expand="block"
                        fill="outline"
                        color="medium"
                        className="editor-form__submit"
                        onClick={() => commit(null, null)}
                    >
                        Clear location
                    </IonButton>
                </EditorFooter>
            )}
        </IonModal>
    );
};

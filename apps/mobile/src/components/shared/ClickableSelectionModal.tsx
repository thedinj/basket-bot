import { IonButton, IonContent, IonIcon, IonModal, IonSearchbar } from "@ionic/react";
import { checkmark } from "ionicons/icons";
import React, { useCallback, useRef, useMemo, useState } from "react";
import { normalizeForSearch } from "../../utils/stringUtils";
import { EditorFooter } from "./EditorFooter";
import { ModalHeader } from "./ModalHeader";

import "./pickerSheet.scss";

export interface SelectableItem {
    id: string;
    label: string;
    /** Optional additional search terms (not displayed in UI) */
    searchTerms?: string[];
    /** Optional subtitle shown below the label in the modal list */
    subtitle?: string;
}

interface ClickableSelectionModalProps {
    /** Array of items to display */
    items: SelectableItem[];
    /** Currently selected item ID */
    value?: string;
    /** Callback when an item is selected */
    onSelect: (itemId: string | null) => void;
    /** Whether the modal is open */
    isOpen: boolean;
    /** Callback to dismiss the modal without selection */
    onDismiss: () => void;
    /** Title displayed in the modal header */
    title: string;
    /** Placeholder text for the search bar */
    searchPlaceholder?: string;
    /** Whether to show the search bar (default: true) */
    showSearch?: boolean;
    /** Size of the modal (default: 'default') */
    size?: "default" | "small";
    /** Whether to allow clearing the selection (default: true) */
    allowClear?: boolean;
}

/**
 * Reusable modal for selecting items from a list.
 * Features:
 * - Click an item to select it and automatically close the modal
 * - Optional search/filter functionality
 * - The currently selected item tinted lilac, with a check
 * - Optional clear button to set value back to null
 * - Clean, simple UX replacing IonSelect + OK/Cancel patterns
 */
export const ClickableSelectionModal: React.FC<ClickableSelectionModalProps> = ({
    items,
    value,
    onSelect,
    isOpen,
    onDismiss,
    title,
    searchPlaceholder = "Search...",
    showSearch = true,
    size = "default",
    allowClear = true,
}) => {
    const [searchText, setSearchText] = useState("");
    const searchbarRef = useRef<HTMLIonSearchbarElement>(null);

    // Filter and tier items based on search text
    const filteredItems = useMemo(() => {
        if (!searchText.trim()) {
            return items;
        }
        const lowerSearch = normalizeForSearch(searchText);

        // Tier items based on match quality
        const tieredItems: Array<{ item: SelectableItem; tier: number }> = [];

        items.forEach((item) => {
            // Both sides go through the same normalizer: singularizing only the search
            // term would make "apples" fail to match the label "Apples".
            const lowerLabel = normalizeForSearch(item.label);

            // Tier 1: Label starts with search string
            if (lowerLabel.startsWith(lowerSearch)) {
                tieredItems.push({ item, tier: 1 });
                return;
            }

            // Tier 2: Search terms start with search string
            if (item.searchTerms?.some((term) => term.toLowerCase().startsWith(lowerSearch))) {
                tieredItems.push({ item, tier: 2 });
                return;
            }

            // Tier 3: Label contains search string
            if (lowerLabel.includes(lowerSearch)) {
                tieredItems.push({ item, tier: 3 });
                return;
            }

            // Tier 4: Search terms contain search string
            if (item.searchTerms?.some((term) => term.toLowerCase().includes(lowerSearch))) {
                tieredItems.push({ item, tier: 4 });
            }
        });

        // Sort by tier, then by label within each tier
        return tieredItems
            .sort((a, b) => {
                if (a.tier !== b.tier) {
                    return a.tier - b.tier;
                }
                return a.item.label.localeCompare(b.item.label);
            })
            .map((tiered) => tiered.item);
    }, [items, searchText]);

    const handleItemClick = (itemId: string) => {
        onSelect(itemId);
        setSearchText(""); // Reset search for next time
        onDismiss();
    };

    const handleDismiss = () => {
        setSearchText(""); // Reset search when dismissed
        onDismiss();
    };

    const handleSearchInput = useCallback(
        (e: CustomEvent<{ value?: string | null }>) => setSearchText(e.detail.value || ""),
        []
    );

    const handleClear = () => {
        onSelect(null);
        setSearchText(""); // Reset search for next time
        onDismiss();
    };

    return (
        <IonModal
            isOpen={isOpen}
            onDidDismiss={handleDismiss}
            onDidPresent={() => showSearch && searchbarRef.current?.setFocus()}
            breakpoints={size === "small" ? [0, 0.5] : undefined}
            initialBreakpoint={size === "small" ? 0.5 : undefined}
        >
            <ModalHeader title={title} onClose={handleDismiss}>
                {showSearch && (
                    <div className="picker-header">
                        <IonSearchbar
                            ref={searchbarRef}
                            className="search-field"
                            value={searchText}
                            onIonInput={handleSearchInput}
                            placeholder={searchPlaceholder}
                            debounce={300}
                        />
                    </div>
                )}
            </ModalHeader>
            <IonContent>
                {filteredItems.length === 0 ? (
                    <p className="picker-empty">
                        {searchText ? "No matching items found" : "No items available"}
                    </p>
                ) : (
                    <ul className="gutter-rows picker-list" role="listbox" aria-label={title}>
                        {filteredItems.map((item) => {
                            const selected = value === item.id;
                            return (
                                <li key={item.id} role="presentation">
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={selected}
                                        className="row-button picker-option"
                                        onClick={() => handleItemClick(item.id)}
                                    >
                                        <span className="picker-option__text">
                                            <span className="picker-option__label">
                                                {item.label}
                                            </span>
                                            {item.subtitle && (
                                                <span className="picker-option__subtitle">
                                                    {item.subtitle}
                                                </span>
                                            )}
                                        </span>
                                        {selected && (
                                            <IonIcon
                                                className="picker-option__check"
                                                icon={checkmark}
                                                aria-hidden="true"
                                            />
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </IonContent>
            {allowClear && value && (
                <EditorFooter>
                    <IonButton
                        expand="block"
                        fill="outline"
                        color="medium"
                        className="editor-form__submit"
                        onClick={handleClear}
                    >
                        Clear selection
                    </IonButton>
                </EditorFooter>
            )}
        </IonModal>
    );
};

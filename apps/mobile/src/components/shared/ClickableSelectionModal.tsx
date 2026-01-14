import {
    IonButton,
    IonButtons,
    IonCheckbox,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonSearchbar,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import React, { useMemo, useState } from "react";
import { normalizeItemName } from "../../utils/stringUtils";

export interface SelectableItem {
    id: string;
    label: string;
    /** Optional additional search terms (not displayed in UI) */
    searchTerms?: string[];
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
 * - Checkbox indicator for currently selected item
 * - Optional clear button to set value back to null
 * - Clean, simple UX replacing IonSelect + OK/Cancel patterns
 */
export const ClickableSelectionModal: React.FC<
    ClickableSelectionModalProps
> = ({
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

    // Filter and tier items based on search text
    const filteredItems = useMemo(() => {
        if (!searchText.trim()) {
            return items;
        }
        const lowerSearch = normalizeItemName(searchText);

        // Tier items based on match quality
        const tieredItems: Array<{ item: SelectableItem; tier: number }> = [];

        items.forEach((item) => {
            const lowerLabel = item.label.toLowerCase();

            // Tier 1: Label starts with search string
            if (lowerLabel.startsWith(lowerSearch)) {
                tieredItems.push({ item, tier: 1 });
                return;
            }

            // Tier 2: Search terms start with search string
            if (
                item.searchTerms?.some((term) =>
                    term.toLowerCase().startsWith(lowerSearch)
                )
            ) {
                tieredItems.push({ item, tier: 2 });
                return;
            }

            // Tier 3: Label contains search string
            if (lowerLabel.includes(lowerSearch)) {
                tieredItems.push({ item, tier: 3 });
                return;
            }

            // Tier 4: Search terms contain search string
            if (
                item.searchTerms?.some((term) =>
                    term.toLowerCase().includes(lowerSearch)
                )
            ) {
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

    const handleClear = () => {
        onSelect(null);
        setSearchText(""); // Reset search for next time
        onDismiss();
    };

    return (
        <IonModal
            isOpen={isOpen}
            onDidDismiss={handleDismiss}
            breakpoints={size === "small" ? [0, 0.5] : undefined}
            initialBreakpoint={size === "small" ? 0.5 : undefined}
            className={size === "small" ? "small-modal" : undefined}
        >
            <IonHeader>
                <IonToolbar>
                    <IonTitle>{title}</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={handleDismiss}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
                {showSearch && (
                    <IonToolbar>
                        <IonSearchbar
                            value={searchText}
                            onIonInput={(e) =>
                                setSearchText(e.detail.value || "")
                            }
                            placeholder={searchPlaceholder}
                            debounce={300}
                        />
                    </IonToolbar>
                )}
            </IonHeader>
            <IonContent>
                <IonList>
                    {filteredItems.length === 0 ? (
                        <IonItem>
                            <IonLabel color="medium">
                                {searchText
                                    ? "No matching items found"
                                    : "No items available"}
                            </IonLabel>
                        </IonItem>
                    ) : (
                        filteredItems.map((item) => (
                            <IonItem
                                key={item.id}
                                button
                                onClick={() => handleItemClick(item.id)}
                                detail={false}
                            >
                                <IonLabel>{item.label}</IonLabel>
                                {value === item.id && (
                                    <IonCheckbox slot="end" checked disabled />
                                )}
                            </IonItem>
                        ))
                    )}
                </IonList>
            </IonContent>
            {allowClear && value && (
                <IonFooter>
                    <IonToolbar>
                        <IonButton
                            expand="block"
                            fill="clear"
                            color="medium"
                            onClick={handleClear}
                        >
                            Clear Selection
                        </IonButton>
                    </IonToolbar>
                </IonFooter>
            )}
        </IonModal>
    );
};

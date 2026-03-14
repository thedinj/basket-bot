import { IonIcon, IonInput, IonItem, IonLabel, IonText } from "@ionic/react";
import { chevronDownOutline } from "ionicons/icons";
import { useState } from "react";
import { naturalSort } from "../../utils/stringUtils";
import { ClickableSelectionModal, SelectableItem } from "./ClickableSelectionModal";

interface ClickableSelectionFieldProps {
    /** Array of items to display in modal */
    items: SelectableItem[];
    /** Currently selected item ID */
    value: string | null | undefined;
    /** Callback when an item is selected */
    onSelect: (itemId: string | null) => void;
    /** Optional stacked label text */
    label?: string;
    /** Text shown when no value is selected */
    placeholder: string;
    /** Override the displayed text completely */
    displayText?: string;
    /** Title for the modal header */
    modalTitle: string;
    /** Whether to show search bar in modal (default: false) */
    showSearch?: boolean;
    /** Placeholder for search bar */
    searchPlaceholder?: string;
    /** Whether to show clear button in modal (default: true) */
    allowClear?: boolean;
    /** Whether the field is disabled */
    disabled?: boolean;
    /** Error message to display below field */
    errorMessage?: string;
    /** Custom styles for the input field */
    inputStyle?: React.CSSProperties;
    /** Whether to show chevron icon on the right side */
    showChevron?: boolean;
    /** Optional icon to display at start of field */
    startIcon?: string;
    /** IonItem lines style (default: full) */
    lines?: "none" | "full" | "inset";
}

/**
 * Reusable field component that combines IonItem with ClickableSelectionModal.
 * Provides consistent UX for selection fields across the app.
 */
export const ClickableSelectionField: React.FC<ClickableSelectionFieldProps> = ({
    items,
    value,
    onSelect,
    label,
    placeholder,
    displayText,
    modalTitle,
    showSearch = false,
    searchPlaceholder = "Search...",
    allowClear = true,
    disabled = false,
    errorMessage,
    inputStyle,
    showChevron = false,
    startIcon,
    lines,
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const sortedItems = [...items].sort(naturalSort((item) => item.label));
    const selectedItem = sortedItems.find((item) => item.id === value);

    const handleSelect = (itemId: string | null) => {
        onSelect(itemId);
        setIsModalOpen(false);
    };

    const handleClick = () => {
        if (!disabled && items.length > 0) {
            setIsModalOpen(true);
        }
    };

    // Determine what to display
    const display = displayText ? displayText : value ? selectedItem?.label : placeholder;

    return (
        <>
            <IonItem
                button
                onClick={handleClick}
                disabled={disabled || items.length === 0}
                lines={lines}
            >
                {startIcon && <IonIcon icon={startIcon} slot="start" color="medium" />}
                {label && <IonLabel position="stacked">{label}</IonLabel>}
                <IonInput
                    value={display}
                    style={{
                        color: value ? "var(--ion-color-dark)" : "var(--ion-color-medium)",
                        cursor: disabled ? "not-allowed" : "pointer",
                        ...inputStyle,
                    }}
                    readonly
                />
                {showChevron && (
                    <IonIcon
                        icon={chevronDownOutline}
                        slot="end"
                        color="medium"
                        style={{ fontSize: "0.9rem", flexShrink: 0 }}
                    />
                )}
            </IonItem>

            {errorMessage && (
                <IonText color="danger">
                    <div style={{ fontSize: "12px", marginLeft: "16px" }}>{errorMessage}</div>
                </IonText>
            )}

            <ClickableSelectionModal
                items={sortedItems}
                value={value || undefined}
                onSelect={handleSelect}
                isOpen={isModalOpen}
                onDismiss={() => setIsModalOpen(false)}
                title={modalTitle}
                showSearch={showSearch}
                searchPlaceholder={searchPlaceholder}
                allowClear={allowClear}
            />
        </>
    );
};

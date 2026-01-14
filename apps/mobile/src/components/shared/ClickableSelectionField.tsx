import { IonInput, IonItem, IonLabel, IonText } from "@ionic/react";
import { useState } from "react";
import {
    ClickableSelectionModal,
    SelectableItem,
} from "./ClickableSelectionModal";

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
}

/**
 * Reusable field component that combines IonItem with ClickableSelectionModal.
 * Provides consistent UX for selection fields across the app.
 */
export const ClickableSelectionField: React.FC<
    ClickableSelectionFieldProps
> = ({
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
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const selectedItem = items.find((item) => item.id === value);

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
    const display = displayText
        ? displayText
        : value
        ? selectedItem?.label
        : placeholder;

    return (
        <>
            <IonItem
                button
                onClick={handleClick}
                disabled={disabled || items.length === 0}
            >
                {label && <IonLabel position="stacked">{label}</IonLabel>}
                <IonInput
                    value={`${display}${showChevron ? " ▾" : ""}`}
                    style={{
                        color: value
                            ? "var(--ion-color-dark)"
                            : "var(--ion-color-medium)",
                        cursor: disabled ? "not-allowed" : "pointer",
                        ...inputStyle,
                    }}
                    readonly
                />
            </IonItem>

            {errorMessage && (
                <IonText color="danger">
                    <div style={{ fontSize: "12px", marginLeft: "16px" }}>
                        {errorMessage}
                    </div>
                </IonText>
            )}

            <ClickableSelectionModal
                items={items}
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

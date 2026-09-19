import { IonIcon } from "@ionic/react";
import clsx from "clsx";
import { chevronDownOutline } from "ionicons/icons";
import { useState } from "react";
import { naturalSort } from "../../utils/stringUtils";
import { ClickableSelectionModal, SelectableItem } from "./ClickableSelectionModal";
import { FormField } from "./FormField";

import "./ClickableSelectionField.scss";

interface ClickableSelectionFieldProps {
    /** Array of items to display in modal */
    items: SelectableItem[];
    /** Currently selected item ID */
    value: string | null | undefined;
    /** Callback when an item is selected */
    onSelect: (itemId: string | null) => void;
    /** Optional field label; when given, the box is wrapped in a FormField */
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
    /** Whether to show chevron icon on the right side */
    showChevron?: boolean;
    /** Optional icon to display at start of field */
    startIcon?: string;
    /** Extra classes on the box (e.g. its share of a row it sits in). */
    className?: string;
}

/**
 * A form-system box (`.form-control--button`) that opens a ClickableSelectionModal. It is the
 * box itself: don't wrap it in another `.form-control`.
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
    showChevron = false,
    startIcon,
    className,
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
    const isPlaceholder = !displayText && !value;

    const box = (
        <button
            type="button"
            className={clsx("form-control form-control--button selection-field", className)}
            onClick={handleClick}
            disabled={disabled || items.length === 0}
            aria-haspopup="dialog"
            aria-label={`${label ?? modalTitle}: ${display ?? placeholder}`}
        >
            {startIcon && (
                <IonIcon className="selection-field__icon" icon={startIcon} aria-hidden="true" />
            )}
            <span
                className={clsx(
                    "form-control__value",
                    isPlaceholder && "form-control__placeholder"
                )}
            >
                {display}
            </span>
            {showChevron && (
                <IonIcon
                    className="form-control__trail"
                    icon={chevronDownOutline}
                    aria-hidden="true"
                />
            )}
        </button>
    );

    return (
        <>
            {label ? (
                <FormField label={label} error={errorMessage}>
                    {box}
                </FormField>
            ) : (
                <>
                    {box}
                    {errorMessage && (
                        <p className="form-field__error" role="alert">
                            {errorMessage}
                        </p>
                    )}
                </>
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

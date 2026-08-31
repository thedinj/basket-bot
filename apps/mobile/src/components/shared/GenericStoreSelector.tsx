import { useMemo } from "react";
import { useVisibleStores } from "../../db/hooks";
import { ClickableSelectionField } from "./ClickableSelectionField";
import type { SelectableItem } from "./ClickableSelectionModal";

interface GenericStoreSelectorProps {
    selectedStoreId: string | null;
    onStoreSelect: (storeId: string | null) => void;
    triggerText?: string;
    placeholderText?: string;
    modalTitle?: string;
    showSearch?: boolean;
    allowClear?: boolean;
    disabled?: boolean;
    excludeStoreIds?: string[];
    inputStyle?: React.CSSProperties;
    showChevron?: boolean;
    startIcon?: string;
    lines?: "none" | "full" | "inset";
}

export const GenericStoreSelector: React.FC<GenericStoreSelectorProps> = ({
    selectedStoreId,
    onStoreSelect,
    triggerText,
    placeholderText = "Select a store",
    modalTitle = "Select Store",
    showSearch = false,
    allowClear = true,
    disabled = false,
    excludeStoreIds,
    inputStyle,
    showChevron = false,
    startIcon,
    lines,
}) => {
    const filteredStores = useVisibleStores({
        keepStoreId: selectedStoreId,
        excludeStoreIds,
    });

    const storeItems: SelectableItem[] = useMemo(() => {
        return filteredStores.map((store) => ({
            id: store.id,
            label: store.name,
        }));
    }, [filteredStores]);

    // `filteredStores` keeps the selected store even when hidden, so it's the right list to
    // resolve the current selection against — no need to consult the unfiltered set.
    const selectedStore = filteredStores.find((s) => s.id === selectedStoreId);

    const displayText = triggerText
        ? triggerText
        : selectedStore
          ? selectedStore?.name
          : !filteredStores.length
            ? "No stores available"
            : placeholderText;

    return (
        <ClickableSelectionField
            items={storeItems}
            value={selectedStoreId}
            onSelect={onStoreSelect}
            placeholder={placeholderText}
            displayText={displayText}
            modalTitle={modalTitle}
            showSearch={showSearch}
            allowClear={allowClear && storeItems.length > 1}
            disabled={disabled}
            inputStyle={inputStyle}
            showChevron={showChevron}
            startIcon={startIcon}
            lines={lines}
        />
    );
};

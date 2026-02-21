import { useMemo } from "react";
import { useStores } from "../../db/hooks";
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
}) => {
    const { data: stores } = useStores();

    const filteredStores = useMemo(() => {
        if (!stores) return [];
        return stores.filter((store) => {
            // Exclude explicitly excluded stores
            if (excludeStoreIds?.includes(store.id)) return false;
            // Include if this is the currently selected store (keep hidden stores visible when selected)
            if (selectedStoreId && store.id === selectedStoreId) return true;
            // Otherwise exclude hidden stores
            return !store.isHidden;
        });
    }, [stores, excludeStoreIds, selectedStoreId]);

    const storeItems: SelectableItem[] = useMemo(() => {
        return filteredStores.map((store) => ({
            id: store.id,
            label: store.name,
        }));
    }, [filteredStores]);

    const selectedStore = stores?.find((s) => s.id === selectedStoreId);

    const displayText = triggerText
        ? triggerText
        : selectedStore
          ? selectedStore?.name
          : !stores?.length
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
        />
    );
};

import { GenericStoreSelector } from "../shared/GenericStoreSelector";
import { useShoppingListContext } from "./useShoppingListContext";

export const StoreSelector: React.FC = () => {
    const { selectedStoreId, setSelectedStoreId } = useShoppingListContext();

    return (
        <GenericStoreSelector
            selectedStoreId={selectedStoreId}
            onStoreSelect={setSelectedStoreId}
            modalTitle="Select Store"
            showSearch={false}
            placeholderText="Select a Store"
            inputStyle={{ fontSize: "1.15rem" }}
            showChevron
        />
    );
};

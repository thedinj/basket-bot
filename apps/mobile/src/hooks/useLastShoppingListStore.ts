import { usePreference } from "./usePreference";

const LAST_SHOPPING_LIST_STORE_KEY = "lastShoppingListStoreId";

export const useLastShoppingListStore = () => {
    const { value: lastShoppingListStoreId, savePreference } = usePreference(
        LAST_SHOPPING_LIST_STORE_KEY
    );

    return {
        lastShoppingListStoreId,
        saveLastShoppingListStore: savePreference,
    };
};

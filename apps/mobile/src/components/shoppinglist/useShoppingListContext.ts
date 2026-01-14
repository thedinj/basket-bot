import { useContext } from "react";
import { ShoppingListContext } from "./ShoppingListContext";

export const useShoppingListContext = () => {
    const context = useContext(ShoppingListContext);
    if (!context) {
        throw new Error(
            "useShoppingListContext must be used within ShoppingListProvider"
        );
    }
    return context;
};

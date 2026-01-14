import { useContext } from "react";
import { StoreItemEditorContext } from "./StoreItemEditorContext";

export const useStoreItemEditorContext = () => {
    const context = useContext(StoreItemEditorContext);
    if (!context) {
        throw new Error(
            "useStoreItemEditorContext must be used within a StoreItemEditorProvider"
        );
    }
    return context;
};

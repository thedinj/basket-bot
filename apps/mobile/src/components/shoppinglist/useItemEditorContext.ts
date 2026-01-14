import { useContext } from "react";
import { ItemEditorContext } from "./itemEditorContextDef";

export const useItemEditorContext = () => {
    const context = useContext(ItemEditorContext);
    if (!context) {
        throw new Error(
            "useItemEditorContext must be used within ItemEditorProvider"
        );
    }
    return context;
};

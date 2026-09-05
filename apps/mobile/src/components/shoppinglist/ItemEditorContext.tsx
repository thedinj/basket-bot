import type { ItemFormData } from "@basket-bot/core";
import React, { PropsWithChildren, RefObject } from "react";
import { Control, FieldErrors, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { useStoreAisles, useStoreSections } from "../../db/hooks";
import { ItemEditorContext, ItemEditorContextType } from "./itemEditorContextDef";
import { useShoppingListContext } from "./useShoppingListContext";

interface ItemEditorProviderProps {
    storeId: string;
    control: Control<ItemFormData>;
    errors: FieldErrors<ItemFormData>;
    setValue: UseFormSetValue<ItemFormData>;
    watch: UseFormWatch<ItemFormData>;
    nameInputRef: RefObject<HTMLIonInputElement | null>;
}

export const ItemEditorProvider: React.FC<PropsWithChildren<ItemEditorProviderProps>> = ({
    storeId,
    control,
    errors,
    setValue,
    watch,
    nameInputRef,
    children,
}) => {
    const { data: aisles } = useStoreAisles(storeId);
    const { data: sections } = useStoreSections(storeId);
    const { editingItem } = useShoppingListContext();

    const value: ItemEditorContextType = {
        control,
        errors,
        setValue,
        watch,
        storeId,
        aisles,
        sections,
        editingItem,
        nameInputRef,
    };

    return <ItemEditorContext.Provider value={value}>{children}</ItemEditorContext.Provider>;
};

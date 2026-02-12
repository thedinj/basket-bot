import type { ItemFormData, ShoppingListItemWithDetails } from "@basket-bot/core";
import React, { PropsWithChildren, ReactNode } from "react";
import { Control, FieldErrors, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { useStoreAisles, useStoreSections } from "../../db/hooks";
import { ItemEditorContext, ItemEditorContextType } from "./itemEditorContextDef";

interface ItemEditorProviderProps {
    storeId: string;
    control: Control<ItemFormData>;
    errors: FieldErrors<ItemFormData>;
    setValue: UseFormSetValue<ItemFormData>;
    watch: UseFormWatch<ItemFormData>;
    editingItem: ShoppingListItemWithDetails | null;
    desiredFavorite: boolean;
    setDesiredFavorite: (value: boolean) => void;
    children: ReactNode;
}

export const ItemEditorProvider: React.FC<PropsWithChildren<ItemEditorProviderProps>> = ({
    storeId,
    control,
    errors,
    setValue,
    watch,
    editingItem,
    desiredFavorite,
    setDesiredFavorite,
    children,
}) => {
    const { data: aisles } = useStoreAisles(storeId);
    const { data: sections } = useStoreSections(storeId);

    const value: ItemEditorContextType = {
        control,
        errors,
        setValue,
        watch,
        storeId,
        aisles,
        sections,
        editingItem,
        desiredFavorite,
        setDesiredFavorite,
    };

    return <ItemEditorContext.Provider value={value}>{children}</ItemEditorContext.Provider>;
};

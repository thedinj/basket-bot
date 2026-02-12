import type { ItemFormData } from "@basket-bot/core";
import React, { PropsWithChildren } from "react";
import { Control, FieldErrors, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { useStoreAisles, useStoreSections } from "../../db/hooks";
import { ItemEditorContext, ItemEditorContextType } from "./itemEditorContextDef";

interface ItemEditorProviderProps {
    storeId: string;
    control: Control<ItemFormData>;
    errors: FieldErrors<ItemFormData>;
    setValue: UseFormSetValue<ItemFormData>;
    watch: UseFormWatch<ItemFormData>;
}

export const ItemEditorProvider: React.FC<PropsWithChildren<ItemEditorProviderProps>> = ({
    storeId,
    control,
    errors,
    setValue,
    watch,
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
    };

    return <ItemEditorContext.Provider value={value}>{children}</ItemEditorContext.Provider>;
};

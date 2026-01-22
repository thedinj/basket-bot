import type { ItemFormData, StoreAisle, StoreSection } from "@basket-bot/core";
import { createContext } from "react";
import { Control, FieldErrors, UseFormSetValue, UseFormWatch } from "react-hook-form";

export interface ItemEditorContextType {
    // Form control
    control: Control<ItemFormData>;
    errors: FieldErrors<ItemFormData>;
    setValue: UseFormSetValue<ItemFormData>;
    watch: UseFormWatch<ItemFormData>;

    // Store data
    storeId: string;
    aisles: StoreAisle[] | undefined;
    sections: StoreSection[] | undefined;
}

export const ItemEditorContext = createContext<ItemEditorContextType | undefined>(undefined);

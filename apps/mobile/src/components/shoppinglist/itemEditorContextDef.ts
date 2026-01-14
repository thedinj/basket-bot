import { createContext } from "react";
import {
    Control,
    FieldErrors,
    UseFormSetValue,
    UseFormWatch,
} from "react-hook-form";
import type { Aisle, ItemFormData, Section } from "./itemEditorSchema";

export interface ItemEditorContextType {
    // Form control
    control: Control<ItemFormData>;
    errors: FieldErrors<ItemFormData>;
    setValue: UseFormSetValue<ItemFormData>;
    watch: UseFormWatch<ItemFormData>;

    // Store data
    storeId: string;
    aisles: Aisle[] | undefined;
    sections: Section[] | undefined;
}

export const ItemEditorContext = createContext<
    ItemEditorContextType | undefined
>(undefined);

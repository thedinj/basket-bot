import { createContext } from "react";
import {
    Control,
    FieldErrors,
    UseFormSetValue,
    UseFormWatch,
} from "react-hook-form";
import type { StoreItemFormData } from "./storeItemEditorSchema";

export interface StoreItemEditorContextType {
    // Form control
    control: Control<StoreItemFormData>;
    errors: FieldErrors<StoreItemFormData>;
    setValue: UseFormSetValue<StoreItemFormData>;
    watch: UseFormWatch<StoreItemFormData>;

    // Store data
    storeId: string;
}

export const StoreItemEditorContext = createContext<
    StoreItemEditorContextType | undefined
>(undefined);

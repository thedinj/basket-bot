import type {
    ItemFormData,
    ShoppingListItemWithDetails,
    StoreAisle,
    StoreSection,
} from "@basket-bot/core";
import { createContext } from "react";
import { Control, FieldErrors, UseFormSetValue, UseFormWatch } from "react-hook-form";

export interface ItemEditorContextType {
    control: Control<ItemFormData>;
    errors: FieldErrors<ItemFormData>;
    setValue: UseFormSetValue<ItemFormData>;
    watch: UseFormWatch<ItemFormData>;
    storeId: string;
    aisles: StoreAisle[] | undefined;
    sections: StoreSection[] | undefined;
    editingItem: ShoppingListItemWithDetails | null;
    desiredFavorite: boolean;
    setDesiredFavorite: (value: boolean) => void;
}

export const ItemEditorContext = createContext<ItemEditorContextType | undefined>(undefined);

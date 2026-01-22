import type { StoreItemFormData } from "@basket-bot/core";
import React, { ReactNode } from "react";
import { UseFormReturn } from "react-hook-form";
import { StoreItemEditorContext } from "./StoreItemEditorContext";

interface StoreItemEditorProviderProps {
    form: UseFormReturn<StoreItemFormData>;
    storeId: string;
    children: ReactNode;
}

export const StoreItemEditorProvider: React.FC<StoreItemEditorProviderProps> = ({
    form,
    storeId,
    children,
}) => {
    const { control, formState, setValue, watch } = form;

    return (
        <StoreItemEditorContext.Provider
            value={{
                control,
                errors: formState.errors,
                setValue,
                watch,
                storeId,
            }}
        >
            {children}
        </StoreItemEditorContext.Provider>
    );
};

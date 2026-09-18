import { IonInput } from "@ionic/react";
import {
    Control,
    FieldErrors,
    FieldValues,
    UseFormSetValue,
    UseFormWatch,
    Path,
} from "react-hook-form";
import { ReactNode } from "react";
import type { DuplicateMatch } from "../../llm/features/itemDedupe";
import { FormField } from "./FormField";
import { LocationSelectors } from "./LocationSelectors";

interface ItemNameAndLocationFieldsProps<T extends FieldValues = FieldValues> {
    control: Control<T>;
    setValue: UseFormSetValue<T>;
    watch: UseFormWatch<T>;
    errors: FieldErrors<T>;
    storeId: number | string;
    disabled?: boolean;
    renderNameField?: (props: { control: Control<T>; errors: FieldErrors<T> }) => ReactNode;
    /** Passed through to `LocationSelectors` — see its prop docs. */
    onUseExistingItem?: (match: DuplicateMatch) => void;
}

export function ItemNameAndLocationFields<T extends FieldValues = FieldValues>({
    control,
    setValue,
    watch,
    errors,
    storeId,
    disabled = false,
    renderNameField,
    onUseExistingItem,
}: ItemNameAndLocationFieldsProps<T>) {
    const storeIdStr = typeof storeId === "number" ? String(storeId) : storeId;
    const itemName = watch("name" as Path<T>);

    return (
        <>
            {renderNameField ? (
                renderNameField({ control, errors })
            ) : (
                <FormField label="Item" error={errors.name?.message as string | undefined}>
                    <div className="form-control">
                        <IonInput
                            {...(control.register?.("name" as never) || {})}
                            aria-label="Item"
                            disabled={disabled}
                            autocapitalize="sentences"
                        />
                    </div>
                </FormField>
            )}

            <LocationSelectors<T>
                control={control}
                storeId={storeIdStr}
                setValue={setValue}
                watch={watch}
                disabled={disabled}
                itemName={itemName}
                onUseExistingItem={onUseExistingItem}
            />
        </>
    );
}

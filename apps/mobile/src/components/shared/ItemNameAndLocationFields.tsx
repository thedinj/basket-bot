import { IonInput, IonItem, IonLabel } from "@ionic/react";
import {
    Control,
    FieldErrors,
    FieldValues,
    UseFormSetValue,
    UseFormWatch,
    Path,
} from "react-hook-form";
import { ReactNode } from "react";
import { LocationSelectors } from "./LocationSelectors";

interface ItemNameAndLocationFieldsProps<T extends FieldValues = FieldValues> {
    control: Control<T>;
    setValue: UseFormSetValue<T>;
    watch: UseFormWatch<T>;
    errors: FieldErrors<T>;
    storeId: number | string;
    disabled?: boolean;
    renderNameField?: (props: {
        control: Control<T>;
        errors: FieldErrors<T>;
    }) => ReactNode;
}

export function ItemNameAndLocationFields<T extends FieldValues = FieldValues>({
    control,
    setValue,
    watch,
    errors,
    storeId,
    disabled = false,
    renderNameField,
}: ItemNameAndLocationFieldsProps<T>) {
    const storeIdStr = typeof storeId === "number" ? String(storeId) : storeId;
    const itemName = watch("name" as Path<T>);

    return (
        <>
            {renderNameField ? (
                renderNameField({ control, errors })
            ) : (
                <IonItem>
                    <IonLabel position="stacked">Name</IonLabel>
                    <IonInput
                        {...(control.register?.("name" as never) || {})}
                        aria-label="Item name"
                        disabled={disabled}
                        autocapitalize="sentences"
                    />
                    {errors.name && (
                        <IonLabel color="danger">
                            {errors.name.message as string}
                        </IonLabel>
                    )}
                </IonItem>
            )}

            <LocationSelectors<T>
                control={control}
                storeId={storeIdStr}
                setValue={setValue}
                watch={watch}
                disabled={disabled}
                itemName={itemName}
            />
        </>
    );
}

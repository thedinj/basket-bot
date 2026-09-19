import { IonInput } from "@ionic/react";
import { Controller } from "react-hook-form";
import { useUnitItems } from "../../hooks/useUnitItems";
import { ClickableSelectionField } from "../shared/ClickableSelectionField";
import { FormField } from "../shared/FormField";
import "./QuantityAndUnitRow.scss";
import { useItemEditorContext } from "./useItemEditorContext";

/** Quantity and Unit merged onto one row — they are one concept ("2 bags") and are
 * empty together 85% of the time, so a full row each is wasted space. */
export const QuantityAndUnitRow = () => {
    const { control, errors } = useItemEditorContext();
    const { unitItems, isLoading } = useUnitItems();

    return (
        <FormField label="Quantity" error={errors.qty?.message || errors.unitId?.message}>
            <div className="qty-unit-row">
                <Controller
                    name="qty"
                    control={control}
                    render={({ field }) => (
                        <div className="form-control qty-unit-row__qty">
                            <IonInput
                                aria-label="Quantity"
                                value={field.value}
                                type="number"
                                inputmode="decimal"
                                min="0"
                                step="any"
                                placeholder="Qty"
                                onIonInput={(e) => {
                                    const val = e.detail.value;
                                    field.onChange(val ? parseFloat(val) : null);
                                }}
                            />
                        </div>
                    )}
                />
                {!isLoading && (
                    <Controller
                        name="unitId"
                        control={control}
                        render={({ field: { onChange, value } }) => (
                            <ClickableSelectionField
                                className="qty-unit-row__unit"
                                items={unitItems}
                                value={value}
                                onSelect={onChange}
                                placeholder="No unit"
                                modalTitle="Select Unit"
                                showSearch={true}
                                searchPlaceholder="Search units..."
                                showChevron
                            />
                        )}
                    />
                )}
            </div>
        </FormField>
    );
};

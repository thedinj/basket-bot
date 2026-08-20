import { IonInput, IonText } from "@ionic/react";
import { Controller } from "react-hook-form";
import { useUnitItems } from "../../hooks/useUnitItems";
import { ClickableSelectionField } from "../shared/ClickableSelectionField";
import "./QuantityAndUnitRow.scss";
import { useItemEditorContext } from "./useItemEditorContext";

/** Quantity and Unit merged onto one row — they are one concept ("2 bags") and are
 * empty together 85% of the time, so a full row each is wasted space. */
export const QuantityAndUnitRow = () => {
    const { control, errors } = useItemEditorContext();
    const { unitItems, isLoading } = useUnitItems();

    return (
        <div className="qty-unit-row">
            <div className="qty-unit-row__label">Quantity</div>
            <div className="qty-unit-row__fields">
                <Controller
                    name="qty"
                    control={control}
                    render={({ field }) => (
                        <IonInput
                            className="qty-unit-row__qty"
                            fill="outline"
                            value={field.value}
                            type="number"
                            min="0"
                            step="any"
                            placeholder="Qty"
                            onIonInput={(e) => {
                                const val = e.detail.value;
                                field.onChange(val ? parseFloat(val) : null);
                            }}
                        />
                    )}
                />
                {!isLoading && (
                    <Controller
                        name="unitId"
                        control={control}
                        render={({ field: { onChange, value } }) => (
                            <div className="qty-unit-row__unit">
                                <ClickableSelectionField
                                    items={unitItems}
                                    value={value}
                                    onSelect={onChange}
                                    placeholder="No unit"
                                    modalTitle="Select Unit"
                                    showSearch={true}
                                    searchPlaceholder="Search units..."
                                    lines="none"
                                    showChevron
                                />
                            </div>
                        )}
                    />
                )}
            </div>
            {(errors.qty || errors.unitId) && (
                <IonText color="danger">
                    <p className="qty-unit-row__error">
                        {errors.qty?.message || errors.unitId?.message}
                    </p>
                </IonText>
            )}
        </div>
    );
};

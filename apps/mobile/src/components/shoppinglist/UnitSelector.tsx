import { Controller } from "react-hook-form";
import { useItemEditorContext } from "./useItemEditorContext";
import { ClickableSelectionField } from "../shared/ClickableSelectionField";
import { useUnitItems } from "../../hooks/useUnitItems";

export const UnitSelector = () => {
    const { control, errors } = useItemEditorContext();
    const { unitItems, isLoading } = useUnitItems();

    if (isLoading) {
        return null;
    }

    return (
        <Controller
            name="unitId"
            control={control}
            render={({ field: { onChange, value } }) => (
                <ClickableSelectionField
                    items={unitItems}
                    value={value}
                    onSelect={onChange}
                    label="Unit"
                    placeholder="No unit"
                    modalTitle="Select Unit"
                    showSearch={true}
                    searchPlaceholder="Search units..."
                    errorMessage={errors.unitId?.message}
                />
            )}
        />
    );
};

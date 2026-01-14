import { useMemo } from "react";
import { Controller } from "react-hook-form";
import { useQuantityUnits } from "../../db/hooks";
import { useItemEditorContext } from "./useItemEditorContext";
import { ClickableSelectionField } from "../shared/ClickableSelectionField";
import type { SelectableItem } from "../shared/ClickableSelectionModal";

export const UnitSelector = () => {
    const { control, errors } = useItemEditorContext();
    const { data: units, isLoading } = useQuantityUnits();

    const unitItems: SelectableItem[] = useMemo(() => {
        return (
            units
                ?.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation))
                .map((unit) => ({
                    id: unit.id,
                    label: unit.abbreviation,
                    searchTerms: [unit.name],
                })) || []
        );
    }, [units]);

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

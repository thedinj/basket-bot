import { helpCircle, helpCircleOutline } from "ionicons/icons";
import { Controller } from "react-hook-form";
import { ItemFlagTile } from "./ItemFlagTile";
import { useItemEditorContext } from "./useItemEditorContext";

export const UnsureToggle = () => {
    const { control } = useItemEditorContext();

    return (
        <Controller
            name="isUnsure"
            control={control}
            render={({ field }) => (
                <ItemFlagTile
                    icon={field.value ? helpCircle : helpCircleOutline}
                    label="Unsure"
                    description="Unsure if needed — double-check before you buy it"
                    checked={field.value ?? false}
                    onChange={field.onChange}
                    tone="warning"
                />
            )}
        />
    );
};

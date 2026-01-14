import { LocationSelectors as SharedLocationSelectors } from "../shared/LocationSelectors";
import { useItemEditorContext } from "./useItemEditorContext";

export const LocationSelectors = () => {
    const { control, setValue, watch, storeId } = useItemEditorContext();
    const itemName = watch("name");

    return (
        <SharedLocationSelectors
            control={control}
            setValue={setValue}
            watch={watch}
            storeId={storeId}
            itemName={itemName}
        />
    );
};

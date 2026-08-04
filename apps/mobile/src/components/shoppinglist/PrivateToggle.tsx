import { Controller } from "react-hook-form";
import { ItemFlagTile } from "./ItemFlagTile";
import { useItemEditorContext } from "./useItemEditorContext";

export const PrivateToggle = () => {
    const { control } = useItemEditorContext();

    return (
        <Controller
            name="isPrivate"
            control={control}
            render={({ field }) => (
                <ItemFlagTile
                    src={field.value ? "/img/private.svg" : "/img/private-filled.svg"}
                    label="Incognito"
                    description="Incognito — hidden from everyone else on this store"
                    checked={field.value ?? false}
                    onChange={field.onChange}
                    tone="secondary"
                />
            )}
        />
    );
};

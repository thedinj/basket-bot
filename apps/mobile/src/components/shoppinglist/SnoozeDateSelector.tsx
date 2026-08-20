import { Controller } from "react-hook-form";
import { SnoozeChips } from "./SnoozeChips";
import { useItemEditorContext } from "./useItemEditorContext";

export const SnoozeDateSelector: React.FC = () => {
    const { control } = useItemEditorContext();

    return (
        <Controller
            name="snoozedUntil"
            control={control}
            render={({ field }) => (
                <SnoozeChips value={field.value ?? null} onChange={field.onChange} />
            )}
        />
    );
};

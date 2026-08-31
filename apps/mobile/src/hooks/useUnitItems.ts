import { useMemo } from "react";
import { useQuantityUnits } from "../db/hooks";
import type { SelectableItem } from "../components/shared/ClickableSelectionModal";

export function useUnitItems() {
    const { data: units, isLoading } = useQuantityUnits();

    const unitItems = useMemo<SelectableItem[]>(
        () =>
            (units ?? [])
                .slice()
                .sort((a, b) => a.abbreviation.localeCompare(b.abbreviation))
                .map((u) => ({ id: u.id, label: u.abbreviation, searchTerms: [u.name] })),
        [units]
    );

    const unitMap = useMemo(
        () => new Map((units ?? []).map((u) => [u.id, u.abbreviation])),
        [units]
    );

    return { unitItems, unitMap, isLoading };
}

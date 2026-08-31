import { useEffect, useMemo, useRef, useState } from "react";
import { useVisibleStores } from "../../db/hooks";
import { sortStoresByPreference } from "../../utils/storeSort";
import { useShoppingListContext } from "./useShoppingListContext";

import "./StoreSelector.scss";

export const StoreSelector: React.FC = () => {
    const { selectedStoreId, setSelectedStoreId } = useShoppingListContext();
    const containerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    // Keep the selected store even if hidden, so hiding the store you're shopping doesn't
    // remove the tab you're standing on.
    const stores = useVisibleStores({ keepStoreId: selectedStoreId });
    const visibleStores = useMemo(() => sortStoresByPreference(stores), [stores]);

    const updateScrollIndicators = () => {
        const el = containerRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 0);
        setCanScrollRight(el.scrollLeft + el.offsetWidth < el.scrollWidth - 1);
    };

    useEffect(() => {
        if (!containerRef.current || !selectedStoreId) return;
        const container = containerRef.current;

        const scrollActiveIntoView = () => {
            const activeBtn = container.querySelector<HTMLButtonElement>(
                ".store-selector-tab--active"
            );
            if (!activeBtn) return;
            const btnLeft = activeBtn.offsetLeft;
            const btnRight = btnLeft + activeBtn.offsetWidth;
            const { scrollLeft, offsetWidth } = container;
            if (btnLeft < scrollLeft) {
                container.scrollLeft = btnLeft - 8;
            } else if (btnRight > scrollLeft + offsetWidth) {
                container.scrollLeft = btnRight - offsetWidth + 8;
            }
            updateScrollIndicators();
        };

        scrollActiveIntoView();
        const raf = requestAnimationFrame(scrollActiveIntoView);
        return () => cancelAnimationFrame(raf);
    }, [selectedStoreId]);

    if (!stores || visibleStores.length <= 1) {
        return null;
    }

    return (
        <div className="store-selector-wrapper">
            {canScrollLeft && <div className="store-selector-fade store-selector-fade--left" />}
            <div
                ref={containerRef}
                className="store-selector-tabs"
                onScroll={updateScrollIndicators}
            >
                {visibleStores.map((store) => (
                    <button
                        key={store.id}
                        className={`store-selector-tab${
                            store.id === selectedStoreId ? " store-selector-tab--active" : ""
                        }`}
                        onClick={() => setSelectedStoreId(store.id)}
                    >
                        {store.name}
                    </button>
                ))}
            </div>
            {canScrollRight && <div className="store-selector-fade store-selector-fade--right" />}
        </div>
    );
};

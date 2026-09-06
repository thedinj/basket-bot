import type { Store } from "@basket-bot/core";
import pluralize from "pluralize";
import {
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonToggle,
} from "@ionic/react";
import clsx from "clsx";
import { DEFAULT_STORE, type ResolvedIngredient } from "../../utils/ingredientRouting";
import IncludeToggleButton from "../shared/IncludeToggleButton";
import SkippedBadge from "../shared/SkippedBadge";
import UnsureToggleButton from "../shared/UnsureToggleButton";

import "./RouteIngredientsContent.scss";

interface RouteIngredientsContentProps {
    resolvedIngredients: ResolvedIngredient[];
    routeMap: Map<string, string | null>;
    setRouteMap: (
        updater: (prev: Map<string, string | null>) => Map<string, string | null>
    ) => void;
    defaultStoreId: string | null;
    setDefaultStoreId: (id: string | null) => void;
    unsureSet: Set<string>;
    onToggleUnsure: (ingredientId: string) => void;
    visibleStores: Store[];
    recipeCount?: number;
    unitMap?: Map<string, string>;
    showSkippedItems: boolean;
    onToggleShowSkippedItems: () => void;
}

const RouteIngredientsContent: React.FC<RouteIngredientsContentProps> = ({
    resolvedIngredients,
    routeMap,
    setRouteMap,
    defaultStoreId,
    setDefaultStoreId,
    unsureSet,
    onToggleUnsure,
    visibleStores,
    recipeCount,
    unitMap,
    showSkippedItems,
    onToggleShowSkippedItems,
}) => {
    const shoppableIngredients = resolvedIngredients.filter((ri) => !ri.excluded);
    const excludedIngredients = resolvedIngredients.filter((ri) => ri.excluded);

    // Group by recipe (in first-appearance order), then within each recipe
    // put shoppable items before skipped items.
    const recipeOrder = new Map<string, number>();
    for (const ri of resolvedIngredients) {
        if (!recipeOrder.has(ri.recipeId)) recipeOrder.set(ri.recipeId, recipeOrder.size);
    }
    const visibleIngredients = (showSkippedItems ? resolvedIngredients : shoppableIngredients)
        .slice()
        .sort((a, b) => {
            const recipeDiff = recipeOrder.get(a.recipeId)! - recipeOrder.get(b.recipeId)!;
            if (recipeDiff !== 0) return recipeDiff;
            return Number(a.excluded) - Number(b.excluded);
        });

    if (shoppableIngredients.length === 0 && !showSkippedItems) {
        return (
            <div className="wizard-empty">
                <IonNote>Every ingredient here will be skipped.</IonNote>
                {excludedIngredients.length > 0 && (
                    <button
                        type="button"
                        className="route-skipped-toggle"
                        onClick={onToggleShowSkippedItems}
                    >
                        Show {excludedIngredients.length} skipped{" "}
                        {pluralize("item", excludedIngredients.length)}
                    </button>
                )}
            </div>
        );
    }

    return (
        <>
            <div className="wizard-route-header">
                <span className="wizard-route-meta">
                    {visibleIngredients.length} {pluralize("ingredient", visibleIngredients.length)}
                    {recipeCount !== undefined
                        ? ` · ${recipeCount} ${pluralize("recipe", recipeCount)}`
                        : ""}
                </span>
                {visibleStores.length > 1 && (
                    <IonSelect
                        className="wizard-default-store-select"
                        value={defaultStoreId}
                        onIonChange={(e) => setDefaultStoreId(e.detail.value)}
                        interface="action-sheet"
                    >
                        {visibleStores.map((s) => (
                            <IonSelectOption key={s.id} value={s.id}>
                                {s.name}
                            </IonSelectOption>
                        ))}
                    </IonSelect>
                )}
                {visibleStores.length === 1 && (
                    <span className="wizard-route-default">
                        Default: <b>{visibleStores[0].name}</b>
                    </span>
                )}
            </div>

            {excludedIngredients.length > 0 && (
                <div className="route-skipped-toggle-row">
                    <IonToggle
                        checked={showSkippedItems}
                        onIonChange={onToggleShowSkippedItems}
                        labelPlacement="start"
                    >
                        Show skipped items ({excludedIngredients.length})
                    </IonToggle>
                </div>
            )}

            <IonList>
                {visibleIngredients.map((ri) => (
                    <IonItem
                        key={ri.ingredientId}
                        className={clsx(
                            "wizard-route-item",
                            ri.excluded && "wizard-route-item--skipped"
                        )}
                    >
                        <IncludeToggleButton
                            included={ri.storeId !== null}
                            onClick={() => {
                                const willExclude = ri.storeId !== null;
                                setRouteMap((prev) => {
                                    const next = new Map(prev);
                                    next.set(ri.ingredientId, willExclude ? null : DEFAULT_STORE);
                                    return next;
                                });
                                if (willExclude && unsureSet.has(ri.ingredientId)) {
                                    onToggleUnsure(ri.ingredientId);
                                }
                            }}
                            label={ri.name}
                        />
                        <UnsureToggleButton
                            active={unsureSet.has(ri.ingredientId)}
                            disabled={ri.storeId === null}
                            onClick={() => onToggleUnsure(ri.ingredientId)}
                        />
                        <IonLabel>
                            <h3>
                                {ri.name}
                                {ri.excluded && <SkippedBadge />}
                            </h3>
                            {ri.scaledQty != null && (
                                <p className="route-ingredient-qty">
                                    {ri.qty !== ri.scaledQty
                                        ? `${ri.qty} → ${ri.scaledQty}`
                                        : ri.scaledQty}
                                    {ri.unitId ? ` ${unitMap?.get(ri.unitId) ?? ""}` : ""}
                                </p>
                            )}
                            {recipeCount !== undefined && (
                                <p className="route-ingredient-recipe">{ri.recipeName}</p>
                            )}
                        </IonLabel>
                        {ri.storeId !== null && visibleStores.length > 1 && (
                            <IonSelect
                                className="wizard-store-select"
                                value={routeMap.get(ri.ingredientId) ?? DEFAULT_STORE}
                                onIonChange={(e) =>
                                    setRouteMap((prev) => {
                                        const next = new Map(prev);
                                        next.set(ri.ingredientId, e.detail.value ?? DEFAULT_STORE);
                                        return next;
                                    })
                                }
                                interface="action-sheet"
                            >
                                <IonSelectOption value={DEFAULT_STORE}>
                                    Default store
                                </IonSelectOption>
                                {visibleStores.map((s) => (
                                    <IonSelectOption key={s.id} value={s.id}>
                                        {s.name}
                                    </IonSelectOption>
                                ))}
                            </IonSelect>
                        )}
                    </IonItem>
                ))}
            </IonList>
        </>
    );
};

export default RouteIngredientsContent;

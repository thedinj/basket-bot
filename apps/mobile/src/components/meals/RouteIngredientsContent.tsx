import type { Store } from "@basket-bot/core";
import pluralize from "pluralize";
import {
    IonCheckbox,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonToggle,
} from "@ionic/react";
import { helpCircle, helpCircleOutline } from "ionicons/icons";
import clsx from "clsx";
import { DEFAULT_STORE, type ResolvedIngredient } from "../../utils/ingredientRouting";
import PantryBadge from "../shared/PantryBadge";

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
    showPantryItems: boolean;
    onToggleShowPantryItems: () => void;
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
    showPantryItems,
    onToggleShowPantryItems,
}) => {
    const shoppableIngredients = resolvedIngredients.filter((ri) => !ri.excluded);
    const pantryIngredients = resolvedIngredients.filter((ri) => ri.excluded);

    // Group by recipe (in first-appearance order), then within each recipe
    // put non-pantry items before pantry items.
    const recipeOrder = new Map<string, number>();
    for (const ri of resolvedIngredients) {
        if (!recipeOrder.has(ri.recipeId)) recipeOrder.set(ri.recipeId, recipeOrder.size);
    }
    const visibleIngredients = (showPantryItems ? resolvedIngredients : shoppableIngredients)
        .slice()
        .sort((a, b) => {
            const recipeDiff = recipeOrder.get(a.recipeId)! - recipeOrder.get(b.recipeId)!;
            if (recipeDiff !== 0) return recipeDiff;
            return Number(a.excluded) - Number(b.excluded);
        });

    if (shoppableIngredients.length === 0 && !showPantryItems) {
        return (
            <div className="wizard-empty">
                <IonNote>All ingredients are pantry-only and will be skipped.</IonNote>
                {pantryIngredients.length > 0 && (
                    <button
                        type="button"
                        className="route-pantry-toggle"
                        onClick={onToggleShowPantryItems}
                    >
                        Show {pantryIngredients.length} pantry{" "}
                        {pluralize("item", pantryIngredients.length)}
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

            {pantryIngredients.length > 0 && (
                <div className="route-pantry-toggle-row">
                    <IonToggle
                        checked={showPantryItems}
                        onIonChange={onToggleShowPantryItems}
                        labelPlacement="start"
                    >
                        Show pantry items ({pantryIngredients.length})
                    </IonToggle>
                </div>
            )}

            <IonList>
                {visibleIngredients.map((ri) => (
                    <IonItem
                        key={ri.ingredientId}
                        className={clsx(
                            "wizard-route-item",
                            ri.excluded && "wizard-route-item--pantry"
                        )}
                    >
                        <IonCheckbox
                            slot="start"
                            checked={ri.storeId !== null}
                            onIonChange={(e) =>
                                setRouteMap((prev) => {
                                    const next = new Map(prev);
                                    next.set(
                                        ri.ingredientId,
                                        e.detail.checked ? DEFAULT_STORE : null
                                    );
                                    return next;
                                })
                            }
                        />
                        <IonLabel>
                            <h3>
                                {ri.name}
                                {ri.excluded && <PantryBadge />}
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
                        {ri.storeId !== null && (
                            <button
                                type="button"
                                className={clsx(
                                    "route-unsure-toggle",
                                    unsureSet.has(ri.ingredientId) && "route-unsure-toggle--active"
                                )}
                                onClick={() => onToggleUnsure(ri.ingredientId)}
                                title="Unsure if needed"
                                aria-pressed={unsureSet.has(ri.ingredientId)}
                            >
                                <IonIcon
                                    icon={
                                        unsureSet.has(ri.ingredientId)
                                            ? helpCircle
                                            : helpCircleOutline
                                    }
                                />
                            </button>
                        )}
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

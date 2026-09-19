import type { Store } from "@basket-bot/core";
import pluralize from "pluralize";
import { IonSelect, IonSelectOption, IonToggle } from "@ionic/react";
import clsx from "clsx";
import { DEFAULT_STORE, type ResolvedIngredient } from "../../utils/ingredientRouting";
import { formatQuantity, formatQuantityWithUnit } from "../../utils/quantity";
import { FormField } from "../shared/FormField";
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

    // One run of rows per recipe. In the wizard (several recipes) each run gets the recipe's
    // name as a ruled label, which is what the per-row recipe line used to repeat.
    const groups: { recipeId: string; recipeName: string; rows: ResolvedIngredient[] }[] = [];
    for (const ri of visibleIngredients) {
        const last = groups[groups.length - 1];
        if (last?.recipeId === ri.recipeId) last.rows.push(ri);
        else groups.push({ recipeId: ri.recipeId, recipeName: ri.recipeName, rows: [ri] });
    }
    const labelGroups = recipeCount !== undefined;

    if (shoppableIngredients.length === 0 && !showSkippedItems) {
        return (
            <div className="route-empty">
                <p className="route-empty__text">Every ingredient here will be skipped.</p>
                {excludedIngredients.length > 0 && (
                    <button
                        type="button"
                        className="route-empty__show"
                        onClick={onToggleShowSkippedItems}
                    >
                        Show {excludedIngredients.length} skipped{" "}
                        {pluralize("item", excludedIngredients.length)}
                    </button>
                )}
            </div>
        );
    }

    const setRoute = (ingredientId: string, storeId: string | null) =>
        setRouteMap((prev) => new Map(prev).set(ingredientId, storeId));

    return (
        <div className="route">
            <div className="route__head">
                {visibleStores.length > 1 && (
                    <FormField label="Default store">
                        <div className="form-control">
                            <IonSelect
                                className="route__default-select"
                                aria-label="Default store"
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
                        </div>
                    </FormField>
                )}

                <div className="route__bar">
                    <span className="route__meta">
                        {visibleIngredients.length}{" "}
                        {pluralize("ingredient", visibleIngredients.length)}
                        {recipeCount !== undefined
                            ? ` · ${recipeCount} ${pluralize("recipe", recipeCount)}`
                            : ""}
                        {visibleStores.length === 1 ? ` · to ${visibleStores[0].name}` : ""}
                    </span>
                    {excludedIngredients.length > 0 && (
                        <IonToggle
                            className="route__skipped-toggle"
                            checked={showSkippedItems}
                            onIonChange={onToggleShowSkippedItems}
                            labelPlacement="start"
                        >
                            Show skipped ({excludedIngredients.length})
                        </IonToggle>
                    )}
                </div>
            </div>

            {groups.map((group) => (
                <section key={group.recipeId} className="route__group">
                    {labelGroups && (
                        <h3 className="ruled-label route__group-label">{group.recipeName}</h3>
                    )}
                    <ul className="route__rows">
                        {group.rows.map((ri) => {
                            const included = ri.storeId !== null;
                            const amount = formatQuantityWithUnit(
                                ri.scaledQty,
                                ri.unitId ? (unitMap?.get(ri.unitId) ?? null) : null
                            );
                            const scaledFrom =
                                ri.qty != null && ri.scaledQty != null && ri.qty !== ri.scaledQty
                                    ? formatQuantity(ri.qty)
                                    : null;
                            return (
                                <li
                                    key={ri.ingredientId}
                                    className={clsx("route-row", !included && "route-row--off")}
                                >
                                    <div className="route-row__toggles">
                                        <IncludeToggleButton
                                            included={included}
                                            onClick={() => {
                                                setRoute(
                                                    ri.ingredientId,
                                                    included ? null : DEFAULT_STORE
                                                );
                                                if (included && unsureSet.has(ri.ingredientId)) {
                                                    onToggleUnsure(ri.ingredientId);
                                                }
                                            }}
                                            label={ri.name}
                                        />
                                        <UnsureToggleButton
                                            active={unsureSet.has(ri.ingredientId)}
                                            onClick={() => {
                                                if (!included) {
                                                    setRoute(ri.ingredientId, DEFAULT_STORE);
                                                }
                                                onToggleUnsure(ri.ingredientId);
                                            }}
                                        />
                                    </div>
                                    <p className="route-row__text">
                                        <span className="route-row__name">{ri.name}</span>
                                        {amount && (
                                            <span className="route-row__qty">
                                                {scaledFrom && (
                                                    <span className="route-row__from">
                                                        {scaledFrom} →{" "}
                                                    </span>
                                                )}
                                                {amount}
                                            </span>
                                        )}
                                        {ri.excluded && <SkippedBadge />}
                                    </p>
                                    {included && visibleStores.length > 1 && (
                                        <IonSelect
                                            className="route-row__store"
                                            aria-label={`Store for ${ri.name}`}
                                            value={routeMap.get(ri.ingredientId) ?? DEFAULT_STORE}
                                            onIonChange={(e) =>
                                                setRoute(
                                                    ri.ingredientId,
                                                    e.detail.value ?? DEFAULT_STORE
                                                )
                                            }
                                            interface="action-sheet"
                                        >
                                            <IonSelectOption value={DEFAULT_STORE}>
                                                Default
                                            </IonSelectOption>
                                            {visibleStores.map((s) => (
                                                <IonSelectOption key={s.id} value={s.id}>
                                                    {s.name}
                                                </IonSelectOption>
                                            ))}
                                        </IonSelect>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </div>
    );
};

export default RouteIngredientsContent;

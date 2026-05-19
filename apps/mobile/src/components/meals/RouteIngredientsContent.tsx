import type { Store } from "@basket-bot/core"
import pluralize from "pluralize"
import {
    IonCheckbox,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSelect,
    IonSelectOption,
} from "@ionic/react"
import { DEFAULT_STORE, type ResolvedIngredient } from "../../hooks/useRouteIngredients"

import "./RouteIngredientsContent.scss"

interface RouteIngredientsContentProps {
    resolvedIngredients: ResolvedIngredient[]
    routeMap: Map<string, string | null>
    setRouteMap: (updater: (prev: Map<string, string | null>) => Map<string, string | null>) => void
    defaultStoreId: string | null
    setDefaultStoreId: (id: string | null) => void
    visibleStores: Store[]
    recipeCount?: number
    unitMap?: Map<string, string>
}

const RouteIngredientsContent: React.FC<RouteIngredientsContentProps> = ({
    resolvedIngredients,
    routeMap,
    setRouteMap,
    defaultStoreId,
    setDefaultStoreId,
    visibleStores,
    recipeCount,
    unitMap,
}) => {
    if (resolvedIngredients.length === 0) {
        return (
            <div className="wizard-empty">
                <IonNote>All ingredients are pantry-only and will be skipped.</IonNote>
            </div>
        )
    }

    return (
        <>
            <div className="wizard-route-header">
                <span className="wizard-route-meta">
                    {resolvedIngredients.length} {pluralize("ingredient", resolvedIngredients.length)}
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

            <IonList>
                {resolvedIngredients.map((ri) => (
                    <IonItem key={ri.ingredientId} className="wizard-route-item">
                        <IonCheckbox
                            slot="start"
                            checked={ri.storeId !== null}
                            onIonChange={(e) =>
                                setRouteMap((prev) => {
                                    const next = new Map(prev)
                                    next.set(ri.ingredientId, e.detail.checked ? DEFAULT_STORE : null)
                                    return next
                                })
                            }
                        />
                        <IonLabel>
                            <h3>{ri.name}</h3>
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
                                        const next = new Map(prev)
                                        next.set(ri.ingredientId, e.detail.value ?? DEFAULT_STORE)
                                        return next
                                    })
                                }
                                interface="action-sheet"
                            >
                                <IonSelectOption value={DEFAULT_STORE}>Default store</IonSelectOption>
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
    )
}

export default RouteIngredientsContent

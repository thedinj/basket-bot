import type { Store } from "@basket-bot/core"
import pluralize from "pluralize"
import {
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonModal,
    IonSpinner,
    IonTitle,
    IonToolbar,
} from "@ionic/react"
import { closeOutline } from "ionicons/icons"
import { useEffect, useMemo, useState } from "react"
import { DEFAULT_STORE, type RawIngredient, useRouteIngredients } from "../../hooks/useRouteIngredients"
import ScaleFactorControl from "./ScaleFactorControl"
import RouteIngredientsContent from "./RouteIngredientsContent"

import "../../pages/MealPlanWizard.scss"

interface RouteIngredientsModalProps {
    isOpen: boolean
    onDismiss: () => void
    rawIngredients: RawIngredient[]
    stores: Store[]
    initialDefaultStoreId?: string | null
    isWorking: boolean
    unitMap?: Map<string, string>
    onConfirm: (routes: Array<{ ingredientId: string; storeId: string | null }>, factor: number) => void
}

const RouteIngredientsModal: React.FC<RouteIngredientsModalProps> = ({
    isOpen,
    onDismiss,
    rawIngredients,
    stores,
    initialDefaultStoreId,
    isWorking,
    unitMap,
    onConfirm,
}) => {
    const visibleStores = useMemo(() => stores.filter((s) => !s.isHidden), [stores])
    const routing = useRouteIngredients()
    const [factor, setFactor] = useState(1)

    useEffect(() => {
        if (!isOpen) return
        setFactor(1)
        const initialMap = new Map<string, string | null>()
        for (const ing of rawIngredients) {
            initialMap.set(ing.id, DEFAULT_STORE)
        }
        const defStore =
            initialDefaultStoreId != null
                ? (visibleStores.find((s) => s.id === initialDefaultStoreId)?.id ?? visibleStores[0]?.id ?? null)
                : (visibleStores[0]?.id ?? null)
        routing.init(initialMap, defStore)
    }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

    const resolvedIngredients = useMemo(
        () =>
            rawIngredients.map((ing) => {
                const raw = routing.routeMap.get(ing.id) ?? null
                const scaledQty = ing.qty != null ? parseFloat((ing.qty * factor).toPrecision(4)) : null
                return {
                    ingredientId: ing.id,
                    recipeId: ing.recipeId,
                    name: ing.name,
                    recipeName: ing.recipeName,
                    storeId: raw === DEFAULT_STORE ? (routing.defaultStoreId ?? null) : raw,
                    qty: ing.qty,
                    scaledQty,
                    unitId: ing.unitId,
                }
            }),
        [rawIngredients, routing.routeMap, routing.defaultStoreId, factor]
    )

    const includedCount = resolvedIngredients.filter((r) => r.storeId !== null).length

    const handleConfirm = () => {
        onConfirm(
            resolvedIngredients.map((r) => ({ ingredientId: r.ingredientId, storeId: r.storeId })),
            factor
        )
    }

    return (
        <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Add to shopping list</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={onDismiss} disabled={isWorking}>
                            <IonIcon slot="icon-only" icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <div className="route-modal-scale-row">
                <ScaleFactorControl factor={factor} onChange={setFactor} />
            </div>

            <IonContent className="wizard-content">
                <RouteIngredientsContent
                    resolvedIngredients={resolvedIngredients}
                    routeMap={routing.routeMap}
                    setRouteMap={routing.setRouteMap}
                    defaultStoreId={routing.defaultStoreId}
                    setDefaultStoreId={routing.setDefaultStoreId}
                    visibleStores={visibleStores}
unitMap={unitMap}
                />
            </IonContent>

            <IonFooter>
                <IonToolbar>
                    <IonButtons slot="end">
                        <IonButton
                            onClick={handleConfirm}
                            disabled={isWorking || includedCount === 0}
                        >
                            {isWorking ? (
                                <IonSpinner name="dots" />
                            ) : (
                                `Add ${includedCount} to ${pluralize("list", includedCount)} →`
                            )}
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonFooter>
        </IonModal>
    )
}

export default RouteIngredientsModal

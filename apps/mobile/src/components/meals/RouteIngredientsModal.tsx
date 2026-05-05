import type { Store } from "@basket-bot/core"
import {
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonModal,
    IonSpinner,
    IonTitle,
    IonToolbar,
} from "@ionic/react"
import { useEffect, useMemo } from "react"
import { DEFAULT_STORE, type RawIngredient, useRouteIngredients } from "../../hooks/useRouteIngredients"
import RouteIngredientsContent from "./RouteIngredientsContent"

import "../../pages/MealPlanWizard.scss"

interface RouteIngredientsModalProps {
    isOpen: boolean
    onDismiss: () => void
    rawIngredients: RawIngredient[]
    stores: Store[]
    initialDefaultStoreId?: string | null
    isWorking: boolean
    onConfirm: (routes: Array<{ ingredientId: string; storeId: string | null }>) => void
}

const RouteIngredientsModal: React.FC<RouteIngredientsModalProps> = ({
    isOpen,
    onDismiss,
    rawIngredients,
    stores,
    initialDefaultStoreId,
    isWorking,
    onConfirm,
}) => {
    const visibleStores = useMemo(() => stores.filter((s) => !s.isHidden), [stores])
    const routing = useRouteIngredients()

    useEffect(() => {
        if (!isOpen) return
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
                return {
                    ingredientId: ing.id,
                    name: ing.name,
                    recipeName: ing.recipeName,
                    storeId: raw === DEFAULT_STORE ? (routing.defaultStoreId ?? null) : raw,
                }
            }),
        [rawIngredients, routing.routeMap, routing.defaultStoreId]
    )

    const includedCount = resolvedIngredients.filter((r) => r.storeId !== null).length

    const handleConfirm = () => {
        onConfirm(resolvedIngredients.map((r) => ({ ingredientId: r.ingredientId, storeId: r.storeId })))
    }

    return (
        <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Add to shopping list</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={onDismiss} disabled={isWorking}>
                            Cancel
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent className="wizard-content">
                <RouteIngredientsContent
                    resolvedIngredients={resolvedIngredients}
                    routeMap={routing.routeMap}
                    setRouteMap={routing.setRouteMap}
                    defaultStoreId={routing.defaultStoreId}
                    setDefaultStoreId={routing.setDefaultStoreId}
                    visibleStores={visibleStores}
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
                                `Add ${includedCount} to list${includedCount !== 1 ? "s" : ""} →`
                            )}
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonFooter>
        </IonModal>
    )
}

export default RouteIngredientsModal

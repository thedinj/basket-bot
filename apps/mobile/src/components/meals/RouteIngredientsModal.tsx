import type { Store } from "@basket-bot/core";
import pluralize from "pluralize";
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
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { useEffect, useMemo, useState } from "react";
import {
    DEFAULT_STORE,
    type RawIngredient,
    useRouteIngredients,
} from "../../hooks/useRouteIngredients";
import { filterVisibleStores } from "../../utils/storeVisibility";
import ScaleFactorControl from "./ScaleFactorControl";
import RouteIngredientsContent from "./RouteIngredientsContent";

import "../../pages/MealPlanWizard.scss";

interface RouteIngredientsModalProps {
    isOpen: boolean;
    onDismiss: () => void;
    rawIngredients: RawIngredient[];
    stores: Store[];
    initialDefaultStoreId?: string | null;
    isWorking: boolean;
    unitMap?: Map<string, string>;
    onConfirm: (
        routes: Array<{ ingredientId: string; storeId: string | null; isUnsure: boolean }>,
        factor: number
    ) => void;
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
    const visibleStores = useMemo(() => filterVisibleStores(stores), [stores]);
    const routing = useRouteIngredients();
    const [factor, setFactor] = useState(1);
    const [showPantryItems, setShowPantryItems] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setFactor(1);
        setShowPantryItems(false);
        const initialMap = new Map<string, string | null>();
        const initialUnsure = new Set<string>();
        for (const ing of rawIngredients) {
            initialMap.set(ing.id, ing.excluded ? null : DEFAULT_STORE);
            if (ing.isUnsure) initialUnsure.add(ing.id);
        }
        const defStore =
            initialDefaultStoreId != null
                ? (visibleStores.find((s) => s.id === initialDefaultStoreId)?.id ??
                  visibleStores[0]?.id ??
                  null)
                : (visibleStores[0]?.id ?? null);
        routing.init(initialMap, defStore, initialUnsure);
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleToggleShowPantryItems = () => {
        setShowPantryItems((prev) => {
            const next = !prev;
            if (!next) {
                // Hiding pantry items again — uncheck any that were checked so a
                // hidden item can never be silently included in the submission.
                routing.setRouteMap((prevMap) => {
                    const nextMap = new Map(prevMap);
                    for (const ing of rawIngredients) {
                        if (ing.excluded) nextMap.set(ing.id, null);
                    }
                    return nextMap;
                });
            }
            return next;
        });
    };

    const resolvedIngredients = useMemo(
        () =>
            rawIngredients.map((ing) => {
                const raw = routing.routeMap.get(ing.id) ?? null;
                const scaledQty =
                    ing.qty != null ? parseFloat((ing.qty * factor).toPrecision(4)) : null;
                return {
                    ingredientId: ing.id,
                    recipeId: ing.recipeId,
                    name: ing.name,
                    recipeName: ing.recipeName,
                    storeId: raw === DEFAULT_STORE ? (routing.defaultStoreId ?? null) : raw,
                    qty: ing.qty,
                    scaledQty,
                    unitId: ing.unitId,
                    isUnsure: routing.unsureSet.has(ing.id),
                    excluded: ing.excluded,
                };
            }),
        [rawIngredients, routing.routeMap, routing.defaultStoreId, routing.unsureSet, factor]
    );

    const includedCount = resolvedIngredients.filter((r) => r.storeId !== null).length;

    const handleConfirm = () => {
        onConfirm(
            resolvedIngredients.map((r) => ({
                ingredientId: r.ingredientId,
                storeId: r.storeId,
                isUnsure: r.isUnsure,
            })),
            factor
        );
    };

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
                    unsureSet={routing.unsureSet}
                    onToggleUnsure={routing.toggleUnsure}
                    visibleStores={visibleStores}
                    unitMap={unitMap}
                    showPantryItems={showPantryItems}
                    onToggleShowPantryItems={handleToggleShowPantryItems}
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
    );
};

export default RouteIngredientsModal;

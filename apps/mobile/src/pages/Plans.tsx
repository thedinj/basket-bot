import {
    IonButton,
    IonContent,
    IonFab,
    IonFabButton,
    IonIcon,
    IonNote,
    IonPage,
    IonSpinner,
} from "@ionic/react";
import { addOutline, calendarOutline, restaurantOutline } from "ionicons/icons";
import pluralize from "pluralize";
import { Suspense, useState } from "react";
import { useHistory } from "react-router-dom";
import { AppHeader } from "../components/layout/AppHeader";
import { HouseholdSelect } from "../components/households/HouseholdSelect";
import LoadingFallback from "../components/LoadingFallback";
import MealsEmptyState from "../components/meals/MealsEmptyState";
import { FabSpacer } from "../components/shared/FabSpacer";
import PullToRefresh from "../components/shared/PullToRefresh";
import RobotLoadingContent from "../components/shared/RobotLoadingContent";
import { usePlansHistory, useRecipes } from "../db/mealsHooks";
import { queryKeys } from "../db/queryKeys";
import RefreshConfig from "../hooks/refresh/RefreshConfig";
import { useHousehold } from "../households/useHousehold";
import MealPlanWizard from "./MealPlanWizard";

import "./Plans.scss";

// The wizard picks recipes from the household's pool, so an empty plan history reads very
// differently depending on whether there's anything to pick from. Split out behind Suspense
// (rather than folding into PlansHistory's own query) since it only needs to resolve when
// the history is actually empty.
const PlansEmptyState: React.FC<{ householdId: string | null }> = ({ householdId }) => {
    const { data: recipes } = useRecipes(householdId);
    const history = useHistory();

    if (recipes.length === 0) {
        return (
            <MealsEmptyState
                icon={restaurantOutline}
                title="No recipes to plan with"
                body="The meal plan wizard picks from your recipes. Add a few, then come back to build a plan."
                action={
                    <IonButton onClick={() => history.push("/recipes")}>Go to Recipes</IonButton>
                }
            />
        );
    }

    return (
        <MealsEmptyState
            icon={calendarOutline}
            title="No plans yet"
            body="No dispatch history. Run the wizard when you're ready to commit."
        />
    );
};

const PlansHistory: React.FC<{ householdId: string | null }> = ({ householdId }) => {
    const { data, isFetching, fetchNextPage, hasNextPage } = usePlansHistory(householdId);

    const plans = data?.pages.flatMap((p) => p.plans) ?? [];
    const total = data?.pages[0]?.total ?? 0;

    if (data !== undefined && !isFetching && plans.length === 0) {
        return (
            <Suspense
                fallback={
                    <div className="plans-history-loading">
                        <RobotLoadingContent />
                    </div>
                }
            >
                <PlansEmptyState householdId={householdId} />
            </Suspense>
        );
    }

    return (
        <div className="plans-history">
            <div className="plans-history-meta">
                {data && (
                    <IonNote>
                        {total} dispatched {pluralize("plan", total)}
                    </IonNote>
                )}
            </div>

            {plans.map((plan) => {
                const date = plan.dispatchedAt
                    ? new Date(plan.dispatchedAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                      })
                    : null;

                return (
                    <div key={plan.id} className="plan-history-card">
                        <div className="plan-history-card__header">
                            <span className="plan-history-card__date">{date ?? "—"}</span>
                            <span className="plan-history-card__count">
                                {plan.slotCount} {pluralize("meal", plan.slotCount)}
                            </span>
                        </div>
                        <div className="plan-history-card__slots">
                            {plan.slots.map((slot) => (
                                <div key={slot.slotNumber} className="plan-history-slot">
                                    <span className="plan-history-slot__num">
                                        {slot.slotNumber}
                                    </span>
                                    <span className="plan-history-slot__name">
                                        {slot.recipeName ?? <em>empty</em>}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {hasNextPage && (
                <div className="plans-history-more">
                    <IonButton
                        fill="clear"
                        size="small"
                        color="medium"
                        onClick={() => fetchNextPage()}
                        disabled={isFetching}
                    >
                        {isFetching ? <IonSpinner name="dots" /> : "Load more"}
                    </IonButton>
                </div>
            )}

            {isFetching && plans.length === 0 && (
                <div className="plans-history-loading">
                    <RobotLoadingContent />
                </div>
            )}
        </div>
    );
};

const Plans: React.FC = () => {
    const { activeHouseholdId } = useHousehold();
    const [wizardOpen, setWizardOpen] = useState(false);
    // Mounted lazily on first open (so its Suspense-based useRecipes query doesn't fire, and
    // can't blank the page, before the wizard is ever used) but never unmounted afterward, so
    // closing the modal doesn't cut off IonModal's dismiss animation mid-flight.
    const [hasOpenedWizard, setHasOpenedWizard] = useState(false);

    return (
        <RefreshConfig
            queryKeys={[
                queryKeys.plansHistory(activeHouseholdId),
                queryKeys.recipes.byHousehold(activeHouseholdId),
            ]}
        >
            <IonPage>
                <AppHeader title="Meal Plans">
                    <HouseholdSelect />
                </AppHeader>

                <IonContent className="plans-page">
                    <PullToRefresh />

                    <PlansHistory householdId={activeHouseholdId} />

                    <FabSpacer />
                </IonContent>

                <IonFab vertical="bottom" horizontal="end" slot="fixed">
                    <IonFabButton
                        color="primary"
                        onClick={() => {
                            setHasOpenedWizard(true);
                            setWizardOpen(true);
                        }}
                        aria-label="Start new plan"
                    >
                        <IonIcon icon={addOutline} />
                    </IonFabButton>
                </IonFab>

                {hasOpenedWizard && (
                    <Suspense fallback={<LoadingFallback />}>
                        <MealPlanWizard
                            isOpen={wizardOpen}
                            onDismiss={() => setWizardOpen(false)}
                        />
                    </Suspense>
                )}
            </IonPage>
        </RefreshConfig>
    );
};

export default Plans;

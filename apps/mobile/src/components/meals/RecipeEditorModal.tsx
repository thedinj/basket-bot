import {
    IonAlert,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToggle,
    IonToolbar,
} from "@ionic/react";
import { addOutline, cart, cartOutline, closeOutline, pricetagOutline, trashOutline } from "ionicons/icons";
import { useEffect, useRef, useState } from "react";
import { useQuantityUnits, useStores } from "../../db/hooks";
import {
    useAddIngredient,
    useAddRecipeToShoppingList,
    useAssignTag,
    useCreateRecipe,
    useDeleteIngredient,
    useDeleteRecipe,
    useRecipe,
    useRemoveTag,
    useTags,
    useUpdateIngredient,
    useUpdateRecipe,
} from "../../db/mealsHooks";
import { usePreference } from "../../hooks/usePreference";
import { useToast } from "../../hooks/useToast";
import RouteIngredientsModal from "./RouteIngredientsModal";
import TagChip from "./TagChip";
import TagManagerModal from "./TagManagerModal";

import "./RecipeEditorModal.scss";

interface IngredientRow {
    rowKey: string;
    id?: string;
    name: string;
    qty: string;
    unitId: string | null;
    excluded: boolean;
}

export interface RecipeInitialData {
    name?: string;
    description?: string;
    steps?: string;
    cookingTimeMinutes?: number | null;
    ingredients?: Array<{
        name: string;
        qty: string;
        unitId: string | null;
        excluded: boolean;
    }>;
}

const genKey = () => Math.random().toString(36).slice(2);
const emptyRow = (): IngredientRow => ({
    rowKey: genKey(),
    name: "",
    qty: "",
    unitId: null,
    excluded: false,
});

interface RecipeEditorModalProps {
    isOpen: boolean;
    onDismiss: () => void;
    onDeleted?: () => void;
    recipeId?: string;
    householdId: string | null;
    initialData?: RecipeInitialData;
}

const RecipeEditorModal: React.FC<RecipeEditorModalProps> = ({
    isOpen,
    onDismiss,
    onDeleted,
    recipeId,
    householdId,
    initialData,
}) => {
    const isNew = !recipeId;
    const { showError } = useToast();

    const { data: recipe, isLoading: recipeLoading } = useRecipe(
        isNew ? null : householdId,
        recipeId ?? null
    );
    const { data: allTags = [] } = useTags(householdId);
    const { data: units } = useQuantityUnits();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [steps, setSteps] = useState("");
    const [cookingTimeMinutes, setCookingTimeMinutes] = useState("");
    const [isPoolExcluded, setIsPoolExcluded] = useState(false);
    const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
    const [ingredients, setIngredients] = useState<IngredientRow[]>([emptyRow()]);
    const [saving, setSaving] = useState(false);
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [tagManagerOpen, setTagManagerOpen] = useState(false);
    const [routeModalOpen, setRouteModalOpen] = useState(false);

    const originalTagIds = useRef<Set<string>>(new Set());
    const originalIngredients = useRef<IngredientRow[]>([]);
    const initialized = useRef(false);

    const createRecipe = useCreateRecipe(householdId);
    const updateRecipe = useUpdateRecipe(householdId);
    const deleteRecipeMutation = useDeleteRecipe(householdId);
    const addIngredientMutation = useAddIngredient(householdId);
    const updateIngredientMutation = useUpdateIngredient(householdId);
    const deleteIngredientMutation = useDeleteIngredient(householdId);
    const assignTag = useAssignTag(householdId);
    const removeTag = useRemoveTag(householdId);
    const addToListMutation = useAddRecipeToShoppingList(householdId, recipeId);
    const { data: stores } = useStores();
    const { value: defaultStoreValue } = usePreference("default_meal_plan_store");

    useEffect(() => {
        if (!isOpen) {
            initialized.current = false;
            setName("");
            setDescription("");
            setSteps("");
            setCookingTimeMinutes("");
            setIsPoolExcluded(false);
            setSelectedTagIds(new Set());
            setIngredients([emptyRow()]);
            originalTagIds.current = new Set();
            originalIngredients.current = [];
            setSaving(false);
            return;
        }

        if (initialized.current) return;

        if (isNew) {
            if (initialData) {
                initialized.current = true;
                setName(initialData.name ?? "");
                setDescription(initialData.description ?? "");
                setSteps(initialData.steps ?? "");
                setCookingTimeMinutes(
                    initialData.cookingTimeMinutes != null
                        ? String(initialData.cookingTimeMinutes)
                        : ""
                );
                if (initialData.ingredients && initialData.ingredients.length > 0) {
                    setIngredients(
                        initialData.ingredients.map((ing) => ({
                            rowKey: genKey(),
                            name: ing.name,
                            qty: ing.qty,
                            unitId: ing.unitId,
                            excluded: ing.excluded,
                        }))
                    );
                }
            }
            return;
        }

        if (!recipe) return;
        initialized.current = true;

        setName(recipe.name);
        setDescription(recipe.description ?? "");
        setSteps(recipe.steps ?? "");
        setCookingTimeMinutes(
            recipe.cookingTimeMinutes != null ? String(recipe.cookingTimeMinutes) : ""
        );
        setIsPoolExcluded(recipe.isPoolExcluded);

        const tagIds = new Set(recipe.tags.map((t) => t.id));
        setSelectedTagIds(tagIds);
        originalTagIds.current = new Set(tagIds);

        const rows: IngredientRow[] =
            recipe.ingredients.length > 0
                ? recipe.ingredients.map((ing) => ({
                      rowKey: genKey(),
                      id: ing.id,
                      name: ing.name,
                      qty: ing.qty !== null ? String(ing.qty) : "",
                      unitId: ing.unitId ?? null,
                      excluded: !!ing.excluded,
                  }))
                : [emptyRow()];

        setIngredients(rows);
        originalIngredients.current = rows.map((r) => ({ ...r }));
    }, [isOpen, isNew, recipe, initialData]);

    const toggleTag = (tagId: string) => {
        setSelectedTagIds((prev) => {
            const next = new Set(prev);
            if (next.has(tagId)) next.delete(tagId);
            else next.add(tagId);
            return next;
        });
    };

    const updateRow = (
        rowKey: string,
        field: keyof Omit<IngredientRow, "rowKey" | "id" | "excluded">,
        value: string | null
    ) => {
        setIngredients((prev) =>
            prev.map((r) => (r.rowKey === rowKey ? { ...r, [field]: value } : r))
        );
    };

    const toggleRowExcluded = (rowKey: string) => {
        setIngredients((prev) =>
            prev.map((r) => (r.rowKey === rowKey ? { ...r, excluded: !r.excluded } : r))
        );
    };

    const removeRow = (rowKey: string) => {
        setIngredients((prev) => {
            const next = prev.filter((r) => r.rowKey !== rowKey);
            return next.length === 0 ? [emptyRow()] : next;
        });
    };

    const handleSave = async () => {
        const trimmedName = name.trim();
        if (!trimmedName || !householdId) return;

        setSaving(true);
        try {
            const cookingTime = cookingTimeMinutes.trim()
                ? parseInt(cookingTimeMinutes.trim(), 10)
                : null;
            const recipeData = {
                name: trimmedName,
                description: description.trim() || undefined,
                steps: steps.trim() || undefined,
                isPoolExcluded: isPoolExcluded || undefined,
                cookingTimeMinutes: cookingTime !== null && !Number.isNaN(cookingTime) ? cookingTime : null,
            };
            const validRows = ingredients.filter((r) => r.name.trim());
            let savedId: string;

            if (isNew) {
                const created = await createRecipe.mutateAsync(recipeData);
                savedId = created.id;

                for (const row of validRows) {
                    await addIngredientMutation.mutateAsync({
                        recipeId: savedId,
                        name: row.name.trim(),
                        qty: row.qty ? Number(row.qty) : null,
                        unitId: row.unitId || null,
                        excluded: row.excluded,
                    });
                }
                for (const tagId of selectedTagIds) {
                    await assignTag.mutateAsync({ recipeId: savedId, tagId });
                }
            } else {
                await updateRecipe.mutateAsync({ recipeId: recipeId!, data: recipeData });
                savedId = recipeId!;

                for (const tagId of selectedTagIds) {
                    if (!originalTagIds.current.has(tagId)) {
                        await assignTag.mutateAsync({ recipeId: savedId, tagId });
                    }
                }
                for (const tagId of originalTagIds.current) {
                    if (!selectedTagIds.has(tagId)) {
                        await removeTag.mutateAsync({ recipeId: savedId, tagId });
                    }
                }

                const origById = new Map(
                    originalIngredients.current.filter((r) => r.id).map((r) => [r.id!, r])
                );
                const currentIds = new Set(validRows.filter((r) => r.id).map((r) => r.id!));

                for (const [id] of origById) {
                    if (!currentIds.has(id)) {
                        await deleteIngredientMutation.mutateAsync({
                            recipeId: savedId,
                            ingredientId: id,
                        });
                    }
                }
                for (const row of validRows) {
                    if (!row.id) {
                        await addIngredientMutation.mutateAsync({
                            recipeId: savedId,
                            name: row.name.trim(),
                            qty: row.qty ? Number(row.qty) : null,
                            unitId: row.unitId || null,
                            excluded: row.excluded,
                        });
                    } else {
                        const orig = origById.get(row.id);
                        if (
                            orig &&
                            (row.name !== orig.name ||
                                row.qty !== orig.qty ||
                                row.unitId !== orig.unitId ||
                                row.excluded !== orig.excluded)
                        ) {
                            await updateIngredientMutation.mutateAsync({
                                recipeId: savedId,
                                ingredientId: row.id,
                                name: row.name.trim(),
                                qty: row.qty ? Number(row.qty) : null,
                                unitId: row.unitId || null,
                                excluded: row.excluded,
                            });
                        }
                    }
                }
            }

            onDismiss();
        } catch (e) {
            showError(`Failed to save: ${e instanceof Error ? e.message : "Unknown error"}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!householdId || !recipeId) return;
        setSaving(true);
        try {
            await deleteRecipeMutation.mutateAsync(recipeId);
            onDismiss();
            onDeleted?.();
        } catch (e) {
            showError(`Failed to delete: ${e instanceof Error ? e.message : "Unknown error"}`);
        } finally {
            setSaving(false);
            setShowDeleteAlert(false);
        }
    };

    const isLoadingEdit = !isNew && recipeLoading && !initialized.current;

    return (
        <IonModal isOpen={isOpen} onDidDismiss={() => onDismiss()}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>{isNew ? "New Recipe" : "Edit Recipe"}</IonTitle>
                    <IonButtons slot="end">
                        {!isNew && (
                            <IonButton onClick={() => setShowDeleteAlert(true)} disabled={saving}>
                                <IonIcon slot="icon-only" icon={trashOutline} />
                            </IonButton>
                        )}
                        <IonButton onClick={() => onDismiss()} disabled={saving}>
                            <IonIcon slot="icon-only" icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent className="ion-padding">
                {isLoadingEdit ? (
                    <div className="recipe-editor-loading">
                        <IonSpinner />
                    </div>
                ) : (
                    <>
                        {/* Name + Cooking time + Pool toggle */}
                        <IonList>
                            <IonItem>
                                <IonLabel position="stacked">Name</IonLabel>
                                <IonInput
                                    value={name}
                                    onIonInput={(e) => setName(e.detail.value ?? "")}
                                    placeholder="Enter recipe name"
                                />
                            </IonItem>
                            <IonItem>
                                <IonLabel position="stacked">Cooking time (minutes)</IonLabel>
                                <IonInput
                                    type="number"
                                    inputMode="numeric"
                                    value={cookingTimeMinutes}
                                    onIonInput={(e) =>
                                        setCookingTimeMinutes(e.detail.value ?? "")
                                    }
                                    placeholder="Optional"
                                    min="1"
                                />
                            </IonItem>
                            {!isNew && (
                                <IonItem>
                                    <IonLabel>Include in meal randomizer</IonLabel>
                                    <IonToggle
                                        slot="end"
                                        checked={!isPoolExcluded}
                                        onIonChange={(e) => setIsPoolExcluded(!e.detail.checked)}
                                    />
                                </IonItem>
                            )}
                        </IonList>

                        {/* Tags */}
                        <div className="recipe-editor-tags-header">
                            <p className="recipe-editor-section-label">Tags</p>
                            <IonButton
                                fill="clear"
                                size="small"
                                color="medium"
                                onClick={() => setTagManagerOpen(true)}
                                className="recipe-editor-tags-manage"
                            >
                                <IonIcon slot="start" icon={pricetagOutline} />
                                {allTags.length === 0 ? "Create tags" : "Manage"}
                            </IonButton>
                        </div>
                        {allTags.length > 0 && (
                            <div className="recipe-editor-tags">
                                {allTags.map((tag) => (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        className={`recipe-editor-tag-btn${selectedTagIds.has(tag.id) ? " selected" : ""}`}
                                        onClick={() => toggleTag(tag.id)}
                                    >
                                        <TagChip tag={tag} />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Ingredients */}
                        <div className="recipe-editor-ingredients-header">
                            <p className="recipe-editor-section-label">Ingredients</p>
                            <span className="recipe-editor-ingredients-hint">
                                <IonIcon icon={cartOutline} />
                                &nbsp;= shopping list
                            </span>
                        </div>
                        <div className="recipe-editor-ingredients">
                            {ingredients.map((row) => (
                                <div key={row.rowKey} className="recipe-editor-ingredient-row">
                                    <div className="recipe-editor-ingredient-row__top">
                                        <IonInput
                                            className="recipe-editor-ing-name"
                                            placeholder="Ingredient name"
                                            value={row.name}
                                            onIonInput={(e) =>
                                                updateRow(row.rowKey, "name", e.detail.value ?? "")
                                            }
                                        />
                                        <IonButton
                                            fill="clear"
                                            size="small"
                                            className={`recipe-editor-cart-btn${!row.excluded ? " included" : ""}`}
                                            onClick={() => toggleRowExcluded(row.rowKey)}
                                            aria-label={row.excluded ? "Not in shopping list" : "In shopping list"}
                                        >
                                            <IonIcon
                                                slot="icon-only"
                                                icon={row.excluded ? cartOutline : cart}
                                            />
                                        </IonButton>
                                        <IonButton
                                            fill="clear"
                                            size="small"
                                            color="medium"
                                            onClick={() => removeRow(row.rowKey)}
                                            aria-label="Remove ingredient"
                                        >
                                            <IonIcon slot="icon-only" icon={closeOutline} />
                                        </IonButton>
                                    </div>
                                    <div className="recipe-editor-ingredient-row__bottom">
                                        <IonInput
                                            className="recipe-editor-qty"
                                            type="number"
                                            placeholder="Qty"
                                            value={row.qty}
                                            onIonInput={(e) =>
                                                updateRow(row.rowKey, "qty", e.detail.value ?? "")
                                            }
                                        />
                                        <span className="recipe-editor-qty-sep">·</span>
                                        <IonSelect
                                            className="recipe-editor-unit-select"
                                            placeholder="Unit"
                                            value={row.unitId}
                                            onIonChange={(e) =>
                                                updateRow(row.rowKey, "unitId", e.detail.value ?? null)
                                            }
                                            interface="action-sheet"
                                        >
                                            <IonSelectOption value={null}>No unit</IonSelectOption>
                                            {units?.map((u) => (
                                                <IonSelectOption key={u.id} value={u.id}>
                                                    {u.abbreviation}
                                                </IonSelectOption>
                                            ))}
                                        </IonSelect>
                                    </div>
                                </div>
                            ))}
                            <IonButton
                                fill="clear"
                                size="small"
                                color="primary"
                                className="recipe-editor-add-ingredient-btn"
                                onClick={() => setIngredients((prev) => [...prev, emptyRow()])}
                            >
                                <IonIcon slot="start" icon={addOutline} />
                                Add ingredient
                            </IonButton>
                        </div>

                        {/* Steps */}
                        <IonList>
                            <IonItem>
                                <IonLabel position="stacked">Steps</IonLabel>
                                <IonTextarea
                                    value={steps}
                                    onIonInput={(e) => setSteps(e.detail.value ?? "")}
                                    placeholder="Enter cooking steps"
                                    autoGrow
                                    rows={4}
                                />
                            </IonItem>
                        </IonList>

                        {/* Notes */}
                        <IonList>
                            <IonItem>
                                <IonLabel position="stacked">Notes</IonLabel>
                                <IonTextarea
                                    value={description}
                                    onIonInput={(e) => setDescription(e.detail.value ?? "")}
                                    placeholder="Enter notes or variations"
                                    autoGrow
                                    rows={3}
                                />
                            </IonItem>
                        </IonList>

                        {!isNew && recipe && recipe.ingredients.some((i) => !i.excluded) && (
                            <IonButton
                                expand="block"
                                fill="outline"
                                onClick={() => setRouteModalOpen(true)}
                                disabled={saving}
                                className="recipe-editor-add-to-list-btn"
                            >
                                <IonIcon slot="start" icon={cartOutline} />
                                Add to shopping list
                            </IonButton>
                        )}

                        <IonButton
                            expand="block"
                            onClick={handleSave}
                            disabled={saving || !name.trim()}
                            className="recipe-editor-save-btn"
                        >
                            {saving ? (
                                <IonSpinner name="dots" />
                            ) : isNew ? (
                                "Add Recipe"
                            ) : (
                                "Save Changes"
                            )}
                        </IonButton>
                    </>
                )}
            </IonContent>

            <TagManagerModal
                isOpen={tagManagerOpen}
                householdId={householdId}
                onDismiss={() => setTagManagerOpen(false)}
            />

            {!isNew && recipe && (
                <RouteIngredientsModal
                    isOpen={routeModalOpen}
                    onDismiss={() => setRouteModalOpen(false)}
                    rawIngredients={recipe.ingredients
                        .filter((i) => !i.excluded)
                        .map((i) => ({ id: i.id, name: i.name, recipeName: recipe.name }))}
                    stores={stores}
                    initialDefaultStoreId={defaultStoreValue ?? null}
                    isWorking={addToListMutation.isPending}
                    onConfirm={async (routes) => {
                        await addToListMutation.mutateAsync(routes)
                        setRouteModalOpen(false)
                    }}
                />
            )}

            <IonAlert
                isOpen={showDeleteAlert}
                onDidDismiss={() => setShowDeleteAlert(false)}
                header="Delete Recipe"
                message={`Permanently delete "${recipe?.name ?? "this recipe"}"? This cannot be undone.`}
                buttons={[
                    { text: "Cancel", role: "cancel" },
                    { text: "Delete", role: "destructive", handler: handleDelete },
                ]}
            />
        </IonModal>
    );
};

export default RecipeEditorModal;

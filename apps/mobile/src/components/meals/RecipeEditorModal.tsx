import {
    IonAlert,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToggle,
    IonToolbar,
} from "@ionic/react";
import { ClickableSelectionModal } from "../shared/ClickableSelectionModal";
import RobotLoadingContent from "../shared/RobotLoadingContent";
import {
    addOutline,
    archive,
    cart,
    closeOutline,
    helpCircle,
    helpCircleOutline,
    pricetagOutline,
    trashOutline,
} from "ionicons/icons";
import { useEffect, useRef, useState } from "react";
import { useUnitItems } from "../../hooks/useUnitItems";
import {
    useAddIngredient,
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
import { useToast } from "../../hooks/useToast";
import SkippedBadge from "../shared/SkippedBadge";
import TagChip from "./TagChip";
import TagManagerModal from "./TagManagerModal";

import "./RecipeEditorModal.scss";

interface IngredientRow {
    rowKey: string;
    id?: string;
    name: string;
    shoppingName: string;
    qty: string;
    shoppingQty: string;
    unitId: string | null;
    shoppingUnitId: string | null;
    excluded: boolean;
    isUnsure: boolean;
    shopExpanded: boolean;
}

export interface RecipeInitialData {
    name?: string;
    source?: string;
    description?: string;
    steps?: string;
    cookingTimeMinutes?: number | null;
    ingredients?: Array<{
        name: string;
        shoppingName?: string | null;
        qty: string;
        shoppingQty?: number | null;
        unitId: string | null;
        shoppingUnitId?: string | null;
        excluded: boolean;
    }>;
}

const genKey = () => Math.random().toString(36).slice(2);
const sortRows = (rows: IngredientRow[]) =>
    [...rows].sort((a, b) => {
        if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
        return a.name.localeCompare(b.name);
    });
const emptyRow = (): IngredientRow => ({
    rowKey: genKey(),
    name: "",
    shoppingName: "",
    qty: "",
    shoppingQty: "",
    unitId: null,
    shoppingUnitId: null,
    excluded: false,
    isUnsure: false,
    shopExpanded: false,
});

interface RecipeEditorModalProps {
    isOpen: boolean;
    onDismiss: () => void;
    onDeleted?: () => void;
    onCreated?: (recipeId: string) => void;
    recipeId?: string;
    householdId: string | null;
    initialData?: RecipeInitialData;
}

const RecipeEditorModal: React.FC<RecipeEditorModalProps> = ({
    isOpen,
    onDismiss,
    onDeleted,
    onCreated,
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
    const { unitItems, unitMap } = useUnitItems();

    const [name, setName] = useState("");
    const [source, setSource] = useState("");
    const [description, setDescription] = useState("");
    const [steps, setSteps] = useState("");
    const [cookingTimeMinutes, setCookingTimeMinutes] = useState("");
    const [isPoolExcluded, setIsPoolExcluded] = useState(false);
    const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
    const [ingredients, setIngredients] = useState<IngredientRow[]>([emptyRow()]);
    const [saving, setSaving] = useState(false);
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [tagManagerOpen, setTagManagerOpen] = useState(false);
    const [unitPickerState, setUnitPickerState] = useState<{
        rowKey: string;
        field: "unitId" | "shoppingUnitId";
    } | null>(null);

    const originalTagIds = useRef<Set<string>>(new Set());
    const originalIngredients = useRef<IngredientRow[]>([]);
    const initialized = useRef(false);
    const nameInputRef = useRef<HTMLIonInputElement>(null);

    const createRecipe = useCreateRecipe(householdId);
    const updateRecipe = useUpdateRecipe(householdId);
    const deleteRecipeMutation = useDeleteRecipe(householdId);
    const addIngredientMutation = useAddIngredient(householdId);
    const updateIngredientMutation = useUpdateIngredient(householdId);
    const deleteIngredientMutation = useDeleteIngredient(householdId);
    const assignTag = useAssignTag(householdId);
    const removeTag = useRemoveTag(householdId);
    useEffect(() => {
        if (!isOpen) {
            initialized.current = false;
            setName("");
            setSource("");
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
                setSource(initialData.source ?? "");
                setDescription(initialData.description ?? "");
                setSteps(initialData.steps ?? "");
                setCookingTimeMinutes(
                    initialData.cookingTimeMinutes != null
                        ? String(initialData.cookingTimeMinutes)
                        : ""
                );
                if (initialData.ingredients && initialData.ingredients.length > 0) {
                    setIngredients(
                        sortRows(
                            initialData.ingredients.map((ing) => ({
                                rowKey: genKey(),
                                name: ing.name,
                                shoppingName: ing.shoppingName ?? "",
                                qty: ing.qty,
                                shoppingQty: ing.shoppingQty != null ? String(ing.shoppingQty) : "",
                                unitId: ing.unitId,
                                shoppingUnitId: ing.shoppingUnitId ?? null,
                                excluded: ing.excluded,
                                isUnsure: false,
                                shopExpanded: !!(
                                    ing.shoppingName ||
                                    ing.shoppingQty != null ||
                                    ing.shoppingUnitId
                                ),
                            }))
                        )
                    );
                }
            }
            return;
        }

        if (!recipe) return;
        initialized.current = true;

        setName(recipe.name);
        setSource(recipe.source ?? "");
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
                ? sortRows(
                      recipe.ingredients.map((ing) => ({
                          rowKey: genKey(),
                          id: ing.id,
                          name: ing.name,
                          shoppingName: ing.shoppingName ?? "",
                          qty: ing.qty !== null ? String(ing.qty) : "",
                          shoppingQty: ing.shoppingQty !== null ? String(ing.shoppingQty) : "",
                          unitId: ing.unitId ?? null,
                          shoppingUnitId: ing.shoppingUnitId ?? null,
                          excluded: !!ing.excluded,
                          isUnsure: !!ing.isUnsure,
                          shopExpanded: !!(
                              ing.shoppingName ||
                              ing.shoppingQty !== null ||
                              ing.shoppingUnitId !== null
                          ),
                      }))
                  )
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
        field: keyof Omit<IngredientRow, "rowKey" | "id" | "excluded" | "isUnsure">,
        value: string | null
    ) => {
        setIngredients((prev) =>
            prev.map((r) => (r.rowKey === rowKey ? { ...r, [field]: value } : r))
        );
    };

    const toggleRowExcluded = (rowKey: string) => {
        setIngredients((prev) =>
            prev.map((r) =>
                r.rowKey === rowKey
                    ? { ...r, excluded: !r.excluded, isUnsure: r.excluded ? r.isUnsure : false }
                    : r
            )
        );
    };

    const toggleRowIsUnsure = (rowKey: string) => {
        setIngredients((prev) =>
            prev.map((r) => (r.rowKey === rowKey ? { ...r, isUnsure: !r.isUnsure } : r))
        );
    };

    const toggleShopExpanded = (rowKey: string) => {
        setIngredients((prev) =>
            prev.map((r) => (r.rowKey === rowKey ? { ...r, shopExpanded: !r.shopExpanded } : r))
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
                source: source.trim() || null,
                description: description.trim() || undefined,
                steps: steps.trim() || undefined,
                isPoolExcluded,
                cookingTimeMinutes:
                    cookingTime !== null && !Number.isNaN(cookingTime) ? cookingTime : null,
            };
            const validRows = ingredients.filter((r) => r.name.trim());
            let savedId: string;

            if (isNew) {
                const created = await createRecipe.mutateAsync(recipeData);
                savedId = created.id;

                for (const row of validRows) {
                    const parsedShoppingQty = row.shoppingQty ? Number(row.shoppingQty) : null;
                    await addIngredientMutation.mutateAsync({
                        recipeId: savedId,
                        name: row.name.trim(),
                        shoppingName: row.shoppingName.trim() || null,
                        qty: row.qty ? Number(row.qty) : null,
                        shoppingQty: parsedShoppingQty,
                        unitId: row.unitId || null,
                        shoppingUnitId: parsedShoppingQty ? row.shoppingUnitId || null : null,
                        excluded: row.excluded,
                        isUnsure: row.isUnsure,
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
                    const parsedShoppingQty = row.shoppingQty ? Number(row.shoppingQty) : null;
                    const resolvedShoppingUnitId = parsedShoppingQty
                        ? row.shoppingUnitId || null
                        : null;
                    if (!row.id) {
                        await addIngredientMutation.mutateAsync({
                            recipeId: savedId,
                            name: row.name.trim(),
                            shoppingName: row.shoppingName.trim() || null,
                            qty: row.qty ? Number(row.qty) : null,
                            shoppingQty: parsedShoppingQty,
                            unitId: row.unitId || null,
                            shoppingUnitId: resolvedShoppingUnitId,
                            excluded: row.excluded,
                            isUnsure: row.isUnsure,
                        });
                    } else {
                        const orig = origById.get(row.id);
                        if (
                            orig &&
                            (row.name !== orig.name ||
                                row.shoppingName !== orig.shoppingName ||
                                row.qty !== orig.qty ||
                                row.shoppingQty !== orig.shoppingQty ||
                                row.unitId !== orig.unitId ||
                                row.shoppingUnitId !== orig.shoppingUnitId ||
                                row.excluded !== orig.excluded ||
                                row.isUnsure !== orig.isUnsure)
                        ) {
                            await updateIngredientMutation.mutateAsync({
                                recipeId: savedId,
                                ingredientId: row.id,
                                name: row.name.trim(),
                                shoppingName: row.shoppingName.trim() || null,
                                qty: row.qty ? Number(row.qty) : null,
                                shoppingQty: parsedShoppingQty,
                                unitId: row.unitId || null,
                                shoppingUnitId: resolvedShoppingUnitId,
                                excluded: row.excluded,
                                isUnsure: row.isUnsure,
                            });
                        }
                    }
                }
            }

            onDismiss();
            if (isNew) onCreated?.(savedId);
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
        <IonModal
            isOpen={isOpen}
            onDidDismiss={() => onDismiss()}
            onDidPresent={() => isNew && nameInputRef.current?.setFocus()}
        >
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
                        <RobotLoadingContent />
                    </div>
                ) : (
                    <>
                        {/* Name + Cooking time + Pool toggle */}
                        <IonList>
                            <IonItem>
                                <IonLabel position="stacked">Name</IonLabel>
                                <IonInput
                                    ref={nameInputRef}
                                    value={name}
                                    onIonInput={(e) => setName(e.detail.value ?? "")}
                                    placeholder="Enter recipe name"
                                    autocapitalize="words"
                                />
                            </IonItem>
                            <IonItem>
                                <IonLabel position="stacked">Source</IonLabel>
                                <IonInput
                                    value={source}
                                    onIonInput={(e) => setSource(e.detail.value ?? "")}
                                    placeholder="Book, website, or creator"
                                    autocapitalize="words"
                                />
                            </IonItem>
                            <IonItem>
                                <IonLabel position="stacked">Cooking time (minutes)</IonLabel>
                                <IonInput
                                    type="number"
                                    inputMode="numeric"
                                    value={cookingTimeMinutes}
                                    onIonInput={(e) => setCookingTimeMinutes(e.detail.value ?? "")}
                                    placeholder="Optional"
                                    min="1"
                                />
                            </IonItem>
                            <IonItem>
                                <IonLabel>Include in meal randomizer</IonLabel>
                                <IonToggle
                                    slot="end"
                                    checked={!isPoolExcluded}
                                    onIonChange={(e) => setIsPoolExcluded(!e.detail.checked)}
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
                                        <TagChip tag={tag} size="md" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Ingredients */}
                        <div className="recipe-editor-ingredients-header">
                            <p className="recipe-editor-section-label">Ingredients</p>
                            <span className="recipe-editor-ingredients-hint">
                                <IonIcon icon={cart} />
                                &nbsp;shopping list&nbsp;&nbsp;
                                <IonIcon icon={archive} />
                                &nbsp;skipped
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
                                            autocapitalize="sentences"
                                        />
                                        {row.excluded && <SkippedBadge />}
                                        <IonButton
                                            fill="clear"
                                            size="small"
                                            className={`recipe-editor-skip-toggle-btn${!row.excluded ? " included" : ""}`}
                                            onClick={() => toggleRowExcluded(row.rowKey)}
                                            aria-label={
                                                row.excluded
                                                    ? "Add to shopping list"
                                                    : "Skip this ingredient"
                                            }
                                        >
                                            <IonIcon
                                                slot="icon-only"
                                                icon={row.excluded ? archive : cart}
                                            />
                                        </IonButton>
                                        {!row.excluded && (
                                            <IonButton
                                                fill="clear"
                                                size="small"
                                                className={`recipe-editor-unsure-toggle-btn${row.isUnsure ? " active" : ""}`}
                                                onClick={() => toggleRowIsUnsure(row.rowKey)}
                                                aria-label={
                                                    row.isUnsure
                                                        ? "Marked unsure if needed"
                                                        : "Mark unsure if needed"
                                                }
                                            >
                                                <IonIcon
                                                    slot="icon-only"
                                                    icon={
                                                        row.isUnsure
                                                            ? helpCircle
                                                            : helpCircleOutline
                                                    }
                                                />
                                            </IonButton>
                                        )}
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
                                    <div className="recipe-editor-ingredient-row__recipe-qty">
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
                                        <button
                                            type="button"
                                            className={`recipe-editor-unit-btn${row.unitId ? " has-value" : ""}`}
                                            onClick={() =>
                                                setUnitPickerState({
                                                    rowKey: row.rowKey,
                                                    field: "unitId",
                                                })
                                            }
                                        >
                                            {row.unitId
                                                ? (unitMap.get(row.unitId) ?? "Unit")
                                                : "Unit"}
                                        </button>
                                    </div>
                                    {row.name.trim() && !row.shopExpanded && (
                                        <IonButton
                                            fill="clear"
                                            size="small"
                                            className="recipe-editor-shop-expand-btn"
                                            onClick={() => toggleShopExpanded(row.rowKey)}
                                        >
                                            <IonIcon slot="start" icon={addOutline} />
                                            Shopping override
                                        </IonButton>
                                    )}
                                    {row.name.trim() && row.shopExpanded && (
                                        <div className="recipe-editor-ingredient-row__shop">
                                            <div className="recipe-editor-ingredient-row__shop-name">
                                                <IonInput
                                                    className="recipe-editor-ing-shopping-name"
                                                    placeholder="Shopping name (if different)"
                                                    value={row.shoppingName}
                                                    onIonInput={(e) =>
                                                        updateRow(
                                                            row.rowKey,
                                                            "shoppingName",
                                                            e.detail.value ?? ""
                                                        )
                                                    }
                                                    autocapitalize="sentences"
                                                />
                                                <IonButton
                                                    fill="clear"
                                                    size="small"
                                                    color="medium"
                                                    className="recipe-editor-shop-collapse-btn"
                                                    onClick={() => toggleShopExpanded(row.rowKey)}
                                                    aria-label="Collapse shopping override"
                                                >
                                                    <IonIcon slot="icon-only" icon={closeOutline} />
                                                </IonButton>
                                            </div>
                                            <div className="recipe-editor-ingredient-row__shop-qty">
                                                <IonInput
                                                    className="recipe-editor-qty recipe-editor-qty--shopping"
                                                    type="number"
                                                    placeholder="Qty"
                                                    value={row.shoppingQty}
                                                    onIonInput={(e) =>
                                                        updateRow(
                                                            row.rowKey,
                                                            "shoppingQty",
                                                            e.detail.value ?? ""
                                                        )
                                                    }
                                                />
                                                <span className="recipe-editor-qty-sep">·</span>
                                                <button
                                                    type="button"
                                                    className={`recipe-editor-unit-btn recipe-editor-unit-btn--shopping${row.shoppingUnitId ? " has-value" : ""}`}
                                                    onClick={() =>
                                                        setUnitPickerState({
                                                            rowKey: row.rowKey,
                                                            field: "shoppingUnitId",
                                                        })
                                                    }
                                                >
                                                    {row.shoppingUnitId
                                                        ? (unitMap.get(row.shoppingUnitId) ??
                                                          "Unit")
                                                        : "Unit"}
                                                </button>
                                            </div>
                                        </div>
                                    )}
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
                    </>
                )}
            </IonContent>

            <IonFooter>
                <IonToolbar>
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
                </IonToolbar>
            </IonFooter>

            <ClickableSelectionModal
                isOpen={unitPickerState !== null}
                items={unitItems}
                value={
                    unitPickerState
                        ? (ingredients.find((r) => r.rowKey === unitPickerState.rowKey)?.[
                              unitPickerState.field
                          ] ?? undefined)
                        : undefined
                }
                title="Select unit"
                allowClear
                onSelect={(id) => {
                    if (unitPickerState) {
                        updateRow(unitPickerState.rowKey, unitPickerState.field, id);
                    }
                }}
                onDismiss={() => setUnitPickerState(null)}
            />

            <TagManagerModal
                isOpen={tagManagerOpen}
                householdId={householdId}
                onDismiss={() => setTagManagerOpen(false)}
            />

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

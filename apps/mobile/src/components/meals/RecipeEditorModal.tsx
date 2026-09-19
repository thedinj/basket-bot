import {
    IonAlert,
    IonButton,
    IonContent,
    IonIcon,
    IonInput,
    IonModal,
    IonSpinner,
    IonTextarea,
    IonToggle,
} from "@ionic/react";
import { ClickableSelectionModal } from "../shared/ClickableSelectionModal";
import { DestructiveAction } from "../shared/DestructiveAction";
import { EditorFooter } from "../shared/EditorFooter";
import { FormField } from "../shared/FormField";
import { ModalHeader } from "../shared/ModalHeader";
import IncludeToggleButton from "../shared/IncludeToggleButton";
import RobotLoadingContent from "../shared/RobotLoadingContent";
import { RowRemoveButton } from "../shared/RowRemoveButton";
import UnsureToggleButton from "../shared/UnsureToggleButton";
import { addOutline, chevronDown, closeOutline, pricetagOutline } from "ionicons/icons";
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
        isUnsure?: boolean;
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

interface AmountFieldsProps {
    qty: string;
    unitLabel: string | null | undefined;
    onQtyChange: (value: string) => void;
    onPickUnit: () => void;
}

/**
 * The quantity box and unit picker under an ingredient (and under its shopping override): two
 * 36px boxes on one line, so every amount in the list starts on the same edge.
 */
const AmountFields: React.FC<AmountFieldsProps> = ({ qty, unitLabel, onQtyChange, onPickUnit }) => (
    <>
        <IonInput
            className="recipe-ing__qty"
            type="number"
            inputMode="decimal"
            placeholder="Qty"
            value={qty}
            onIonInput={(e) => onQtyChange(e.detail.value ?? "")}
            aria-label="Quantity"
        />
        <button
            type="button"
            className={`recipe-ing__unit${unitLabel ? " recipe-ing__unit--set" : ""}`}
            onClick={onPickUnit}
        >
            <span className="recipe-ing__unit-text">{unitLabel ?? "Unit"}</span>
            <IonIcon icon={chevronDown} aria-hidden="true" />
        </button>
    </>
);

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
                                isUnsure: !!ing.isUnsure,
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
            prev.map((r) =>
                r.rowKey === rowKey
                    ? r.excluded
                        ? { ...r, excluded: false, isUnsure: true }
                        : { ...r, isUnsure: !r.isUnsure }
                    : r
            )
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
            <ModalHeader
                title={isNew ? "New Recipe" : "Edit Recipe"}
                onClose={() => onDismiss()}
                closeDisabled={saving}
            />

            <IonContent className="ion-padding">
                {isLoadingEdit ? (
                    <div className="recipe-editor-loading">
                        <RobotLoadingContent />
                    </div>
                ) : (
                    <div className="editor-form recipe-editor">
                        <FormField label="Name">
                            <div className="form-control">
                                <IonInput
                                    ref={nameInputRef}
                                    value={name}
                                    onIonInput={(e) => setName(e.detail.value ?? "")}
                                    placeholder="Recipe name"
                                    autocapitalize="words"
                                    aria-label="Name"
                                />
                            </div>
                        </FormField>

                        <FormField label="Source">
                            <div className="form-control">
                                <IonInput
                                    value={source}
                                    onIonInput={(e) => setSource(e.detail.value ?? "")}
                                    placeholder="Book, website, or creator"
                                    autocapitalize="words"
                                    aria-label="Source"
                                />
                            </div>
                        </FormField>

                        <div className="recipe-editor__pair">
                            <FormField label="Cook time">
                                <div className="form-control">
                                    <IonInput
                                        type="number"
                                        inputMode="numeric"
                                        value={cookingTimeMinutes}
                                        onIonInput={(e) =>
                                            setCookingTimeMinutes(e.detail.value ?? "")
                                        }
                                        placeholder="Optional"
                                        min="1"
                                        aria-label="Cook time in minutes"
                                    />
                                    <span className="recipe-editor__suffix">min</span>
                                </div>
                            </FormField>
                            <FormField label="Randomizer">
                                <div className="form-control">
                                    <IonToggle
                                        labelPlacement="start"
                                        justify="space-between"
                                        checked={!isPoolExcluded}
                                        onIonChange={(e) => setIsPoolExcluded(!e.detail.checked)}
                                    >
                                        Include in pool
                                    </IonToggle>
                                </div>
                            </FormField>
                        </div>

                        <FormField
                            label="Tags"
                            action={
                                <button
                                    type="button"
                                    className="form-field__action"
                                    onClick={() => setTagManagerOpen(true)}
                                >
                                    <IonIcon icon={pricetagOutline} aria-hidden="true" />
                                    {allTags.length === 0 ? "Create tags" : "Manage"}
                                </button>
                            }
                        >
                            {allTags.length > 0 ? (
                                <div className="recipe-editor__tags">
                                    {allTags.map((tag) => (
                                        <button
                                            key={tag.id}
                                            type="button"
                                            className="recipe-editor__tag-btn"
                                            aria-pressed={selectedTagIds.has(tag.id)}
                                            onClick={() => toggleTag(tag.id)}
                                        >
                                            <TagChip
                                                tag={tag}
                                                size="md"
                                                selected={selectedTagIds.has(tag.id)}
                                            />
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="recipe-editor__empty">No tags yet.</p>
                            )}
                        </FormField>

                        <FormField label="Ingredients">
                            <div className="boxed-list">
                                {ingredients.map((row) => (
                                    <div
                                        key={row.rowKey}
                                        className={`recipe-ing${row.excluded ? " recipe-ing--excluded" : ""}`}
                                    >
                                        <div className="recipe-ing__top">
                                            <IonInput
                                                className="recipe-ing__name"
                                                placeholder="Ingredient"
                                                value={row.name}
                                                onIonInput={(e) =>
                                                    updateRow(
                                                        row.rowKey,
                                                        "name",
                                                        e.detail.value ?? ""
                                                    )
                                                }
                                                autocapitalize="sentences"
                                                aria-label="Ingredient name"
                                            />
                                            <div className="recipe-ing__actions">
                                                <IncludeToggleButton
                                                    included={!row.excluded}
                                                    onClick={() => toggleRowExcluded(row.rowKey)}
                                                    label={row.name || "this ingredient"}
                                                />
                                                <UnsureToggleButton
                                                    active={row.isUnsure}
                                                    onClick={() => toggleRowIsUnsure(row.rowKey)}
                                                />
                                                <RowRemoveButton
                                                    onClick={() => removeRow(row.rowKey)}
                                                    label={
                                                        row.name
                                                            ? `Remove ${row.name}`
                                                            : "Remove ingredient"
                                                    }
                                                />
                                            </div>
                                        </div>
                                        <div className="recipe-ing__amounts">
                                            <AmountFields
                                                qty={row.qty}
                                                unitLabel={
                                                    row.unitId ? unitMap.get(row.unitId) : null
                                                }
                                                onQtyChange={(v) => updateRow(row.rowKey, "qty", v)}
                                                onPickUnit={() =>
                                                    setUnitPickerState({
                                                        rowKey: row.rowKey,
                                                        field: "unitId",
                                                    })
                                                }
                                            />
                                            {row.name.trim() && !row.shopExpanded && (
                                                <button
                                                    type="button"
                                                    className="recipe-ing__override-btn"
                                                    onClick={() => toggleShopExpanded(row.rowKey)}
                                                >
                                                    <IonIcon icon={addOutline} aria-hidden="true" />
                                                    Shop as
                                                </button>
                                            )}
                                        </div>
                                        {row.name.trim() && row.shopExpanded && (
                                            <div className="recipe-ing__override">
                                                <div className="recipe-ing__override-head">
                                                    <span className="recipe-ing__override-label">
                                                        Shop as
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="recipe-ing__override-close"
                                                        onClick={() =>
                                                            toggleShopExpanded(row.rowKey)
                                                        }
                                                        aria-label="Collapse shopping override"
                                                    >
                                                        <IonIcon
                                                            icon={closeOutline}
                                                            aria-hidden="true"
                                                        />
                                                    </button>
                                                </div>
                                                <IonInput
                                                    className="recipe-ing__override-name"
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
                                                    aria-label="Shopping name"
                                                />
                                                <div className="recipe-ing__amounts">
                                                    <AmountFields
                                                        qty={row.shoppingQty}
                                                        unitLabel={
                                                            row.shoppingUnitId
                                                                ? unitMap.get(row.shoppingUnitId)
                                                                : null
                                                        }
                                                        onQtyChange={(v) =>
                                                            updateRow(row.rowKey, "shoppingQty", v)
                                                        }
                                                        onPickUnit={() =>
                                                            setUnitPickerState({
                                                                rowKey: row.rowKey,
                                                                field: "shoppingUnitId",
                                                            })
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    className="row-button recipe-ing-add"
                                    onClick={() => setIngredients((prev) => [...prev, emptyRow()])}
                                >
                                    <IonIcon icon={addOutline} aria-hidden="true" />
                                    Add ingredient
                                </button>
                            </div>
                        </FormField>

                        <FormField label="Steps">
                            <div className="form-control form-control--multiline">
                                <IonTextarea
                                    value={steps}
                                    onIonInput={(e) => setSteps(e.detail.value ?? "")}
                                    placeholder="One step per line"
                                    autoGrow
                                    rows={5}
                                    aria-label="Steps"
                                />
                            </div>
                        </FormField>

                        <FormField label="Notes">
                            <div className="form-control form-control--multiline">
                                <IonTextarea
                                    value={description}
                                    onIonInput={(e) => setDescription(e.detail.value ?? "")}
                                    placeholder="Variations, substitutions, verdicts"
                                    autoGrow
                                    rows={3}
                                    aria-label="Notes"
                                />
                            </div>
                        </FormField>

                        {!isNew && (
                            <DestructiveAction
                                onClick={() => setShowDeleteAlert(true)}
                                disabled={saving}
                            >
                                Delete recipe
                            </DestructiveAction>
                        )}
                    </div>
                )}
            </IonContent>

            <EditorFooter>
                <IonButton
                    expand="block"
                    onClick={handleSave}
                    disabled={saving || !name.trim()}
                    className="editor-form__submit"
                >
                    {saving ? <IonSpinner name="dots" /> : isNew ? "Add Recipe" : "Save Changes"}
                </IonButton>
            </EditorFooter>

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

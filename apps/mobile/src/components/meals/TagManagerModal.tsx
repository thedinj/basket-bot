import type { TagPaletteKey } from "@basket-bot/core";
import { TAG_PALETTE_KEYS } from "@basket-bot/core";
import {
    IonAlert,
    IonButton,
    IonContent,
    IonIcon,
    IonInput,
    IonModal,
    IonSpinner,
} from "@ionic/react";
import { checkmarkOutline, createOutline } from "ionicons/icons";
import { useState } from "react";
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from "../../db/mealsHooks";
import { EditorFooter } from "../shared/EditorFooter";
import { FormField } from "../shared/FormField";
import { ModalHeader } from "../shared/ModalHeader";
import { RobotLine } from "../shared/RobotLine";
import { RowRemoveButton } from "../shared/RowRemoveButton";
import TagChip from "./TagChip";

import "./TagManagerModal.scss";

interface TagManagerModalProps {
    isOpen: boolean;
    onDismiss: () => void;
    householdId: string | null;
}

const swatchName = (key: TagPaletteKey): string => key.charAt(0).toUpperCase() + key.slice(1);

const TagManagerModal: React.FC<TagManagerModalProps> = ({ isOpen, onDismiss, householdId }) => {
    const { data: tags = [] } = useTags(householdId);
    const createTag = useCreateTag(householdId);
    const updateTag = useUpdateTag(householdId);
    const deleteTag = useDeleteTag(householdId);

    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);

    const [editingTag, setEditingTag] = useState<{
        id: string;
        name: string;
        colorKey: TagPaletteKey | null;
    } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

    const handleCreate = async () => {
        const name = newName.trim();
        if (!name || !householdId) return;
        setCreating(true);
        try {
            await createTag.mutateAsync({ name });
            setNewName("");
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        await deleteTag.mutateAsync(deleteTarget.id);
        // Don't leave the editor open on a tag that no longer exists.
        setEditingTag((t) => (t?.id === deleteTarget.id ? null : t));
        setDeleteTarget(null);
    };

    const handleSaveEdit = async () => {
        if (!editingTag) return;
        const name = editingTag.name.trim();
        if (!name) return;
        await updateTag.mutateAsync({
            tagId: editingTag.id,
            data: { name, colorKey: editingTag.colorKey },
        });
        setEditingTag(null);
    };

    const openEdit = (id: string, name: string, colorKey: TagPaletteKey | null) => {
        setEditingTag({ id, name, colorKey });
    };

    return (
        <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
            <ModalHeader title="Manage Tags" onClose={onDismiss} />

            <IonContent className="ion-padding">
                <div className="tag-manager">
                    <section className="tag-manager__section">
                        <h2 className="ruled-label">
                            Tags <span className="ruled-label__count">{tags.length}</span>
                        </h2>
                        {tags.length > 0 ? (
                            <ul className="boxed-list">
                                {tags.map((tag) => {
                                    const isEditing = editingTag?.id === tag.id;
                                    return (
                                        <li
                                            key={tag.id}
                                            className={`tag-manager-row${isEditing ? " tag-manager-row--editing" : ""}`}
                                        >
                                            <div className="tag-manager-row__chip">
                                                <TagChip tag={tag} size="md" />
                                            </div>
                                            <div className="tag-manager-row__actions">
                                                <button
                                                    type="button"
                                                    className="tag-manager-row__edit"
                                                    onClick={() =>
                                                        openEdit(tag.id, tag.name, tag.colorKey)
                                                    }
                                                    aria-pressed={isEditing}
                                                    aria-label={`Edit tag ${tag.name}`}
                                                >
                                                    <IonIcon
                                                        icon={createOutline}
                                                        aria-hidden="true"
                                                    />
                                                </button>
                                                <RowRemoveButton
                                                    onClick={() =>
                                                        setDeleteTarget({
                                                            id: tag.id,
                                                            name: tag.name,
                                                        })
                                                    }
                                                    label={`Delete tag ${tag.name}`}
                                                />
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <RobotLine>
                                No tags yet. Create one below to start categorising recipes.
                            </RobotLine>
                        )}
                    </section>

                    {editingTag ? (
                        <div className="editor-form">
                            <FormField label="Rename tag">
                                <div className="form-control">
                                    <IonInput
                                        value={editingTag.name}
                                        onIonInput={(e) =>
                                            setEditingTag((t) =>
                                                t ? { ...t, name: e.detail.value ?? "" } : null
                                            )
                                        }
                                        onKeyUp={(e) => {
                                            if (e.key === "Enter") handleSaveEdit();
                                        }}
                                        aria-label="Tag name"
                                        autocapitalize="sentences"
                                        autoFocus
                                    />
                                </div>
                            </FormField>
                            <FormField label="Colour">
                                <div className="tag-manager-palette">
                                    {TAG_PALETTE_KEYS.map((key) => {
                                        const isSelected = editingTag.colorKey === key;
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                className="tag-palette-swatch"
                                                style={
                                                    {
                                                        "--swatch-bg": `var(--tag-${key}-bg)`,
                                                        "--swatch-border": `var(--tag-${key}-border)`,
                                                        "--swatch-text": `var(--tag-${key}-text)`,
                                                    } as React.CSSProperties
                                                }
                                                onClick={() =>
                                                    setEditingTag((t) =>
                                                        t ? { ...t, colorKey: key } : null
                                                    )
                                                }
                                                aria-pressed={isSelected}
                                                aria-label={swatchName(key)}
                                            >
                                                {isSelected && (
                                                    <IonIcon
                                                        icon={checkmarkOutline}
                                                        aria-hidden="true"
                                                    />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </FormField>
                        </div>
                    ) : (
                        <div className="editor-form">
                            <FormField label="New tag">
                                <div className="form-control">
                                    <IonInput
                                        value={newName}
                                        onIonInput={(e) => setNewName(e.detail.value ?? "")}
                                        placeholder="Enter tag name"
                                        onKeyUp={(e) => {
                                            if (e.key === "Enter") handleCreate();
                                        }}
                                        aria-label="New tag name"
                                        autocapitalize="sentences"
                                    />
                                </div>
                            </FormField>
                        </div>
                    )}
                </div>
            </IonContent>

            <EditorFooter
                onBack={editingTag ? () => setEditingTag(null) : undefined}
                backLabel="Cancel edit"
            >
                {editingTag ? (
                    <IonButton
                        className="editor-form__submit"
                        expand="block"
                        onClick={handleSaveEdit}
                        disabled={!editingTag.name.trim() || updateTag.isPending}
                    >
                        {updateTag.isPending ? (
                            <IonSpinner name="dots" />
                        ) : (
                            <>
                                <IonIcon slot="start" icon={checkmarkOutline} />
                                Save
                            </>
                        )}
                    </IonButton>
                ) : (
                    <IonButton
                        className="editor-form__submit"
                        expand="block"
                        onClick={handleCreate}
                        disabled={!newName.trim() || creating}
                    >
                        {creating ? <IonSpinner name="dots" /> : "Create Tag"}
                    </IonButton>
                )}
            </EditorFooter>

            {/* Delete confirm */}
            <IonAlert
                isOpen={!!deleteTarget}
                onDidDismiss={() => setDeleteTarget(null)}
                header="Delete Tag"
                message={`Remove "${deleteTarget?.name}"? It will be unassigned from all recipes.`}
                buttons={[
                    { text: "Cancel", role: "cancel" },
                    { text: "Delete", role: "destructive", handler: handleDelete },
                ]}
            />
        </IonModal>
    );
};

export default TagManagerModal;

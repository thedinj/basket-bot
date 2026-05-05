import type { TagPaletteKey } from "@basket-bot/core"
import { TAG_PALETTE_KEYS } from "@basket-bot/core"
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
    IonSpinner,
    IonTitle,
    IonToolbar,
} from "@ionic/react"
import { checkmarkOutline, closeOutline, createOutline, trashOutline } from "ionicons/icons"
import { useRef, useState } from "react"
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from "../../db/mealsHooks"
import TagChip from "./TagChip"

import "./TagManagerModal.scss"

interface TagManagerModalProps {
    isOpen: boolean
    onDismiss: () => void
    householdId: string | null
}

const TagManagerModal: React.FC<TagManagerModalProps> = ({ isOpen, onDismiss, householdId }) => {
    const { data: tags = [] } = useTags(householdId)
    const createTag = useCreateTag(householdId)
    const updateTag = useUpdateTag(householdId)
    const deleteTag = useDeleteTag(householdId)

    const [newName, setNewName] = useState("")
    const [creating, setCreating] = useState(false)

    const [editingTag, setEditingTag] = useState<{
        id: string
        name: string
        colorKey: TagPaletteKey | null
    } | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

    const newInputRef = useRef<HTMLIonInputElement>(null)

    const handleCreate = async () => {
        const name = newName.trim()
        if (!name || !householdId) return
        setCreating(true)
        try {
            await createTag.mutateAsync({ name })
            setNewName("")
        } finally {
            setCreating(false)
        }
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        await deleteTag.mutateAsync(deleteTarget.id)
        setDeleteTarget(null)
    }

    const handleSaveEdit = async () => {
        if (!editingTag) return
        const name = editingTag.name.trim()
        if (!name) return
        await updateTag.mutateAsync({
            tagId: editingTag.id,
            data: { name, colorKey: editingTag.colorKey },
        })
        setEditingTag(null)
    }

    const openEdit = (id: string, name: string, colorKey: TagPaletteKey | null) => {
        setEditingTag({ id, name, colorKey })
    }

    return (
        <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Manage Tags</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={onDismiss}>
                            <IonIcon slot="icon-only" icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent className="ion-padding">
                {tags.length > 0 && (
                    <IonList className="tag-manager-list">
                        {tags.map((tag) => (
                            <IonItem key={tag.id} className="tag-manager-item" lines="full">
                                <TagChip tag={tag} size="md" />
                                <IonButtons slot="end">
                                    <IonButton
                                        fill="clear"
                                        size="small"
                                        color="medium"
                                        onClick={() => openEdit(tag.id, tag.name, tag.colorKey)}
                                    >
                                        <IonIcon slot="icon-only" icon={createOutline} />
                                    </IonButton>
                                    <IonButton
                                        fill="clear"
                                        size="small"
                                        color="medium"
                                        onClick={() =>
                                            setDeleteTarget({ id: tag.id, name: tag.name })
                                        }
                                    >
                                        <IonIcon slot="icon-only" icon={trashOutline} />
                                    </IonButton>
                                </IonButtons>
                            </IonItem>
                        ))}
                    </IonList>
                )}

                {tags.length === 0 && (
                    <p className="tag-manager-empty">
                        No tags yet. Create one below to start categorising recipes.
                    </p>
                )}

                {editingTag ? (
                    <div className="tag-manager-edit">
                        <IonItem>
                            <IonLabel position="stacked">Rename tag</IonLabel>
                            <IonInput
                                value={editingTag.name}
                                onIonInput={(e) =>
                                    setEditingTag((t) =>
                                        t ? { ...t, name: e.detail.value ?? "" } : null
                                    )
                                }
                                onKeyUp={(e) => {
                                    if (e.key === "Enter") handleSaveEdit()
                                }}
                                autoFocus
                            />
                        </IonItem>
                        <div className="tag-manager-palette">
                            {TAG_PALETTE_KEYS.map((key) => (
                                <button
                                    key={key}
                                    className={`tag-palette-swatch${editingTag.colorKey === key ? " selected" : ""}`}
                                    style={
                                        {
                                            "--swatch-bg": `var(--tag-${key}-bg)`,
                                            "--swatch-border": `var(--tag-${key}-border)`,
                                            "--swatch-text": `var(--tag-${key}-text)`,
                                        } as React.CSSProperties
                                    }
                                    onClick={() =>
                                        setEditingTag((t) => (t ? { ...t, colorKey: key } : null))
                                    }
                                    aria-label={key}
                                />
                            ))}
                        </div>
                        <div className="tag-manager-edit-actions">
                            <IonButton
                                fill="clear"
                                color="medium"
                                onClick={() => setEditingTag(null)}
                            >
                                Cancel
                            </IonButton>
                            <IonButton onClick={handleSaveEdit} disabled={!editingTag.name.trim()}>
                                <IonIcon slot="start" icon={checkmarkOutline} />
                                Save
                            </IonButton>
                        </div>
                    </div>
                ) : (
                    <div className="tag-manager-new">
                        <IonItem>
                            <IonLabel position="stacked">New tag</IonLabel>
                            <IonInput
                                ref={newInputRef}
                                value={newName}
                                onIonInput={(e) => setNewName(e.detail.value ?? "")}
                                placeholder="Enter tag name"
                                onKeyUp={(e) => {
                                    if (e.key === "Enter") handleCreate()
                                }}
                            />
                        </IonItem>
                        <IonButton
                            expand="block"
                            onClick={handleCreate}
                            disabled={!newName.trim() || creating}
                            style={{ marginTop: "12px" }}
                        >
                            {creating ? <IonSpinner name="dots" /> : "Create Tag"}
                        </IonButton>
                    </div>
                )}
            </IonContent>

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
    )
}

export default TagManagerModal

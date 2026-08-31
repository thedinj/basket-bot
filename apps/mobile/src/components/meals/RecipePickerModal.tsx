import type { RecipeTag, RecipeWithDetails } from "@basket-bot/core";
import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonNote,
    IonSearchbar,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { useState } from "react";
import TagChip from "./TagChip";
import TagChipList from "./TagChipList";

interface RecipePickerModalProps {
    isOpen: boolean;
    onDismiss: () => void;
    recipes: RecipeWithDetails[];
    onPick: (recipe: RecipeWithDetails) => void;
    filterTags?: RecipeTag[];
    maxCookingTimeMinutes?: number | null;
    title?: string;
}

const RecipePickerModal: React.FC<RecipePickerModalProps> = ({
    isOpen,
    onDismiss,
    recipes,
    onPick,
    filterTags = [],
    maxCookingTimeMinutes,
    title = "Pick a recipe",
}) => {
    const [query, setQuery] = useState("");

    const filtered = query.trim()
        ? recipes.filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()))
        : recipes;

    const hasFilters = filterTags.length > 0 || maxCookingTimeMinutes != null;

    const handleDismiss = () => {
        setQuery("");
        onDismiss();
    };

    const handlePick = (recipe: RecipeWithDetails) => {
        setQuery("");
        onPick(recipe);
    };

    return (
        <IonModal isOpen={isOpen} onDidDismiss={handleDismiss}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>{title}</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={handleDismiss}>
                            <IonIcon slot="icon-only" icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
                <IonToolbar>
                    <IonSearchbar
                        value={query}
                        onIonInput={(e) => setQuery(e.detail.value ?? "")}
                        placeholder="Search recipes"
                        debounce={0}
                    />
                </IonToolbar>
                {hasFilters && (
                    <IonToolbar>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "4px 12px 8px",
                                flexWrap: "wrap",
                            }}
                        >
                            <IonNote
                                style={{
                                    fontSize: "11px",
                                    fontFamily: "'JetBrains Mono', monospace",
                                    flexShrink: 0,
                                }}
                            >
                                filtered:
                            </IonNote>
                            {filterTags.map((t) => (
                                <TagChip key={t.id} tag={t} />
                            ))}
                            {maxCookingTimeMinutes != null && (
                                <IonNote
                                    style={{
                                        fontSize: "11px",
                                        fontFamily: "'JetBrains Mono', monospace",
                                    }}
                                >
                                    ≤{maxCookingTimeMinutes}min
                                </IonNote>
                            )}
                        </div>
                    </IonToolbar>
                )}
            </IonHeader>

            <IonContent>
                {filtered.length === 0 ? (
                    <div className="ion-padding ion-text-center">
                        <IonNote>
                            {query.trim()
                                ? `No recipes match "${query}"`
                                : "No recipes match these filters"}
                        </IonNote>
                    </div>
                ) : (
                    <IonList>
                        {filtered.map((recipe) => (
                            <IonItem
                                key={recipe.id}
                                button
                                detail={false}
                                onClick={() => handlePick(recipe)}
                            >
                                <IonLabel>
                                    <h3>{recipe.name}</h3>
                                    {recipe.source && (
                                        <p
                                            style={{
                                                fontSize: "12px",
                                                color: "var(--ion-color-step-400, #718096)",
                                                margin: "2px 0 0",
                                            }}
                                        >
                                            {recipe.source}
                                        </p>
                                    )}
                                    {recipe.tags.length > 0 && (
                                        <TagChipList
                                            tags={recipe.tags}
                                            max={4}
                                            className="recipe-picker-item-tags"
                                        />
                                    )}
                                </IonLabel>
                            </IonItem>
                        ))}
                    </IonList>
                )}
            </IonContent>
        </IonModal>
    );
};

export default RecipePickerModal;

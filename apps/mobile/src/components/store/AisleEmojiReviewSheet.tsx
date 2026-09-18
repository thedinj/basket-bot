import {
    IonButton,
    IonCheckbox,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import React, { useEffect, useState } from "react";
import type { AisleEmojiSuggestion } from "../../llm/features/aisleEmoji";

type AisleEmojiReviewSheetProps = {
    suggestions: AisleEmojiSuggestion[];
    isOpen: boolean;
    isApplying: boolean;
    onApply: (accepted: AisleEmojiSuggestion[]) => void;
    onDismiss: () => void;
};

/**
 * Review step for "Suggest emoji": every suggestion starts checked; untick any to skip it.
 * Suggestions are drawn in the plate's monochrome face, so the review shows what the list will.
 */
export const AisleEmojiReviewSheet: React.FC<AisleEmojiReviewSheetProps> = ({
    suggestions,
    isOpen,
    isApplying,
    onApply,
    onDismiss,
}) => {
    const [skipped, setSkipped] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) setSkipped(new Set());
    }, [isOpen, suggestions]);

    const accepted = suggestions.filter((s) => !skipped.has(s.aisleId));

    const toggle = (aisleId: string, checked: boolean) =>
        setSkipped((prev) => {
            const next = new Set(prev);
            if (checked) next.delete(aisleId);
            else next.add(aisleId);
            return next;
        });

    return (
        <IonModal
            isOpen={isOpen}
            onDidDismiss={onDismiss}
            initialBreakpoint={0.75}
            breakpoints={[0, 0.75, 1]}
        >
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Suggested emoji</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                <IonList>
                    {suggestions.map((s) => (
                        <IonItem key={s.aisleId} lines="none">
                            <IonCheckbox
                                slot="start"
                                checked={!skipped.has(s.aisleId)}
                                onIonChange={(e) => toggle(s.aisleId, e.detail.checked)}
                                aria-label={`Use ${s.emoji} for ${s.name}`}
                            />
                            <IonLabel>
                                <span className="scan-aisle-emoji">{s.emoji}</span>
                                {s.name}
                            </IonLabel>
                        </IonItem>
                    ))}
                </IonList>
                <IonButton
                    className="editor-form__submit"
                    expand="block"
                    disabled={accepted.length === 0 || isApplying}
                    onClick={() => onApply(accepted)}
                >
                    Apply {accepted.length} emoji
                </IonButton>
            </IonContent>
        </IonModal>
    );
};

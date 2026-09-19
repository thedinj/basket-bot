import { IonButton, IonCheckbox, IonContent, IonModal } from "@ionic/react";
import React, { useEffect, useState } from "react";
import type { AisleEmojiSuggestion } from "../../llm/features/aisleEmoji";
import { AislePlate } from "../shared/AislePlate";
import { EditorFooter } from "../shared/EditorFooter";
import { ModalHeader } from "../shared/ModalHeader";
import "./AisleEmojiReviewSheet.scss";

type AisleEmojiReviewSheetProps = {
    suggestions: AisleEmojiSuggestion[];
    isOpen: boolean;
    isApplying: boolean;
    onApply: (accepted: AisleEmojiSuggestion[]) => void;
    onDismiss: () => void;
};

/**
 * Review step for "Suggest emoji": every suggestion starts checked; untick any to skip it.
 * Each suggestion is drawn on the aisle's own plate, so the review shows what the list will.
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
            <ModalHeader title="Suggested emoji" onClose={onDismiss} />
            <IonContent className="emoji-review">
                <h2 className="ruled-label emoji-review__label">
                    Aisles
                    <span className="ruled-label__count">
                        {accepted.length}/{suggestions.length}
                    </span>
                </h2>
                <ul className="emoji-review__list">
                    {suggestions.map((s) => (
                        <li key={s.aisleId} className="emoji-review__row">
                            <IonCheckbox
                                className="emoji-review__check"
                                labelPlacement="start"
                                justify="space-between"
                                checked={!skipped.has(s.aisleId)}
                                onIonChange={(e) => toggle(s.aisleId, e.detail.checked)}
                                aria-label={`Use ${s.emoji} for ${s.name}`}
                            >
                                <span className="emoji-review__aisle">
                                    <AislePlate badge={s.emoji} kind="emoji" />
                                    <span className="emoji-review__name">{s.name}</span>
                                </span>
                            </IonCheckbox>
                        </li>
                    ))}
                </ul>
            </IonContent>
            <EditorFooter>
                <IonButton
                    className="editor-form__submit"
                    expand="block"
                    disabled={accepted.length === 0 || isApplying}
                    onClick={() => onApply(accepted)}
                >
                    Apply {accepted.length} emoji
                </IonButton>
            </EditorFooter>
        </IonModal>
    );
};

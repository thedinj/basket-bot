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
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import clsx from "clsx";
import { closeOutline, diceOutline, nuclear } from "ionicons/icons";
import { useCallback, useEffect, useState } from "react";
import { type AnimationEffect, pickStrike, STRIKE_POOL } from "../../animations/effects";
import { preloadStrikeSounds } from "../../animations/strikeAudio";
import { useOverlayAnimation } from "../../hooks/useOverlayAnimation";
import { HazardRule } from "../shared/HazardRule";
import { OverlayAnimation } from "../shared/OverlayAnimation";

import "./StrikeRangeModal.scss";

interface StrikeRangeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Developer test bed for the munition pool.
 *
 * Nine effects cannot be reviewed through the real flows - seeing a specific one means seeding
 * orphan items and re-rolling until the pool happens to hand it to you. Here every munition is
 * one tap away, which is the only way to judge whether any two of them read as the same event.
 */
const StrikeRangeModal: React.FC<StrikeRangeModalProps> = ({ isOpen, onClose }) => {
    // Every fire here passes an explicit override, so the seed effect is only ever the hook's
    // default and never actually plays on its own.
    const { trigger, isActive, cssClass, activeEffect } = useOverlayAnimation(STRIKE_POOL[0]);
    const [lastRolled, setLastRolled] = useState<AnimationEffect | null>(null);

    // Warm every sound in the pool so range testing measures the animation, not a cold fetch.
    useEffect(() => {
        if (isOpen) preloadStrikeSounds(STRIKE_POOL);
    }, [isOpen]);

    const handleRoll = useCallback(() => {
        const rolled = pickStrike();
        setLastRolled(rolled);
        void trigger(rolled);
    }, [trigger]);

    return (
        <IonModal isOpen={isOpen} onDidDismiss={onClose}>
            <IonHeader>
                <IonToolbar>
                    <IonIcon
                        slot="start"
                        icon={nuclear}
                        color="warning"
                        style={{ marginInlineStart: "12px", fontSize: "20px" }}
                    />
                    <IonTitle>Strike Range</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={onClose} disabled={isActive}>
                            <IonIcon slot="icon-only" icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent>
                <div className="strike-range-header">
                    <div className="strike-range-label">
                        <span>Ordnance inventory</span>
                        <span aria-hidden="true">&middot;</span>
                        <span>{STRIKE_POOL.length} loaded</span>
                    </div>
                    <p className="strike-range-note">
                        Fire any munition directly, or roll for one the way the Obliterate actions
                        do. A roll never returns the same munition twice running.
                    </p>
                    <IonButton
                        size="small"
                        fill="outline"
                        color="warning"
                        onClick={handleRoll}
                        disabled={isActive}
                    >
                        <IonIcon slot="start" icon={diceOutline} />
                        Roll
                    </IonButton>
                    {lastRolled && (
                        <div className="strike-range-rolled">Last roll: {lastRolled.label}</div>
                    )}
                </div>
                <HazardRule />

                <IonList>
                    {STRIKE_POOL.map((effect) => (
                        <IonItem
                            key={effect.cssClass}
                            button
                            detail={false}
                            disabled={isActive}
                            className={clsx(activeEffect === effect && "strike-range-row--firing")}
                            onClick={() => void trigger(effect)}
                        >
                            <IonLabel className="ion-text-wrap">
                                <h3 className="strike-range-row-name">{effect.label}</h3>
                                <IonNote className="strike-range-row-data">
                                    {effect.cssClass} &middot; {effect.duration}ms &middot; impact{" "}
                                    {effect.impactAtMs}ms &middot;{" "}
                                    {effect.soundPath?.split("/").pop() ?? "silent"}
                                </IonNote>
                            </IonLabel>
                        </IonItem>
                    ))}
                </IonList>
            </IonContent>

            {/* Inside the modal on purpose: this is an IonModal stacked above the About modal, so
                an overlay rendered by a parent would paint behind it. Same reason as
                ObliterateUnusedModal. */}
            <OverlayAnimation cssClass={cssClass} />
        </IonModal>
    );
};

export default StrikeRangeModal;

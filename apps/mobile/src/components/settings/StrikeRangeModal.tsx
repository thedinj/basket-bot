import { IonContent, IonIcon, IonModal } from "@ionic/react";
import clsx from "clsx";
import { diceOutline, nuclear } from "ionicons/icons";
import { useCallback, useEffect, useState } from "react";
import { type AnimationEffect, pickStrike, STRIKE_POOL } from "../../animations/effects";
import { preloadStrikeSounds } from "../../animations/strikeAudio";
import { useOverlayAnimation } from "../../hooks/useOverlayAnimation";
import { HazardRule } from "../shared/HazardRule";
import { ModalHeader } from "../shared/ModalHeader";
import { OverlayAnimation } from "../shared/OverlayAnimation";

import "./StrikeRangeModal.scss";

interface StrikeRangeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Developer test bed for the munition pool.
 *
 * The pool cannot be reviewed through the real flows - seeing a specific one means seeding
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
            <ModalHeader
                title="Strike Range"
                onClose={onClose}
                closeDisabled={isActive}
                start={
                    <IonIcon
                        className="strike-range-title-icon"
                        icon={nuclear}
                        aria-hidden="true"
                    />
                }
            />

            <IonContent>
                <section className="strike-range">
                    <h2 className="ruled-label strike-range__label">
                        Ordnance inventory
                        <span className="ruled-label__count">{STRIKE_POOL.length} loaded</span>
                    </h2>
                    <p className="strike-range__note">
                        Fire any munition directly, or roll for one the way the Obliterate actions
                        do. A roll never returns the same munition twice running.
                    </p>
                    <div className="strike-range__toolbar">
                        <span className="strike-range__rolled">
                            Last roll: {lastRolled?.label ?? "none"}
                        </span>
                        <button
                            type="button"
                            className="form-field__action form-field__action--standalone strike-range__roll"
                            onClick={handleRoll}
                            disabled={isActive}
                        >
                            <IonIcon icon={diceOutline} aria-hidden="true" />
                            Roll
                        </button>
                    </div>
                </section>
                <HazardRule />

                <ul className="gutter-rows">
                    {STRIKE_POOL.map((effect) => (
                        <li key={effect.cssClass}>
                            <button
                                type="button"
                                className={clsx(
                                    "row-button strike-range__row",
                                    activeEffect === effect && "strike-range__row--firing"
                                )}
                                disabled={isActive}
                                onClick={() => void trigger(effect)}
                            >
                                <span className="strike-range__name">{effect.label}</span>
                                <span className="strike-range__data">
                                    {effect.cssClass} &middot; {effect.duration}ms &middot; impact{" "}
                                    {effect.impactAtMs}ms &middot;{" "}
                                    {effect.soundPath?.split("/").pop() ?? "silent"}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </IonContent>

            {/* Inside the modal on purpose: this is an IonModal stacked above the About modal, so
                an overlay rendered by a parent would paint behind it. Same reason as
                ObliterateUnusedModal. */}
            <OverlayAnimation cssClass={cssClass} />
        </IonModal>
    );
};

export default StrikeRangeModal;

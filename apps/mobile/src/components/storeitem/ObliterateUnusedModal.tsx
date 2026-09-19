import {
    IonButton,
    IonContent,
    IonIcon,
    IonModal,
    IonSkeletonText,
    IonSpinner,
} from "@ionic/react";
import clsx from "clsx";
import { nuclear, shieldCheckmarkOutline } from "ionicons/icons";
import pluralize from "pluralize";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { type AnimationEffect, pickStrike } from "../../animations/effects";
import { preloadStrikeSound } from "../../animations/strikeAudio";
import { useDeleteOrphanItems, useOrphanItems } from "../../db/itemHooks";
import { useOverlayAnimation } from "../../hooks/useOverlayAnimation";
import { useToast } from "../../hooks/useToast";
import { EditorFooter } from "../shared/EditorFooter";
import { HazardRule } from "../shared/HazardRule";
import { ModalHeader } from "../shared/ModalHeader";
import { OverlayAnimation } from "../shared/OverlayAnimation";
import { RobotLine } from "../shared/RobotLine";
import TabEmptyState from "../shared/TabEmptyState";

import "./ObliterateUnusedModal.scss";

/**
 * Dismiss this far before the overlay clears, so the sheet never flickers back into view
 * un-faded between the strike ending and the modal closing. Subtracted from whichever munition
 * was loaded rather than pinned to one, since they run 0.9s to 1.8s.
 */
const DISMISS_LEAD_MS = 50;

interface ObliterateUnusedModalProps {
    isOpen: boolean;
    onClose: () => void;
    storeId: string;
}

const LoadingRows: React.FC = () => (
    <div className="obliterate-manifest">
        <RobotLine>Designating targets</RobotLine>
        <ol className="obliterate-targets" aria-hidden="true">
            {[60, 45, 70, 50, 38].map((width, i) => (
                <li key={i} className="obliterate-target">
                    <span className="obliterate-target__num">{i + 1}</span>
                    <IonSkeletonText
                        animated
                        className="obliterate-target__skeleton"
                        style={{ width: `${width}%` }}
                    />
                </li>
            ))}
        </ol>
    </div>
);

/**
 * Confirmation sheet for the store item list's "Obliterate Unused" action.
 *
 * The list is fetched from the server rather than filtered on the client: eligibility depends
 * on whether *any* member has the item on a list, including private rows this client never
 * sees. It is therefore also the only honest preview — the caller's button may appear when
 * this comes back empty, which the empty state states plainly.
 */
const ObliterateUnusedModal: React.FC<ObliterateUnusedModalProps> = ({
    isOpen,
    onClose,
    storeId,
}) => {
    const { data: orphans, isLoading } = useOrphanItems(storeId, isOpen);
    const deleteOrphanItems = useDeleteOrphanItems();
    const { showSuccess, showInfo } = useToast();
    // Rolled when the sheet opens rather than when Authorize is tapped, so the manifest can
    // name the munition before you commit to it - and so its sound has the whole read-the-list
    // pause to finish loading.
    const [munition, setMunition] = useState<AnimationEffect>(pickStrike);
    const {
        trigger: triggerStrike,
        isActive: isDetonating,
        cssClass,
    } = useOverlayAnimation(munition);
    const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const next = pickStrike();
        setMunition(next);
        // Opening the sheet is a user gesture, which is what mobile WebViews wait for before
        // doing any audio work. Warming it here is why the sound lands on time.
        preloadStrikeSound(next);
    }, [isOpen]);

    // A pending dismiss that outlives this component would call onClose() against a
    // stale closure - the same guard ShoppingList.tsx uses around its obliteration timer.
    useEffect(() => {
        return () => {
            if (dismissTimeoutRef.current) {
                clearTimeout(dismissTimeoutRef.current);
                dismissTimeoutRef.current = null;
            }
        };
    }, []);

    // Locked while the delete is in flight *and* while the blast plays, so the sheet
    // cannot be dismissed out from under its own detonation.
    const isWorking = deleteOrphanItems.isPending || isDetonating;
    const count = orphans?.length ?? 0;

    const handleConfirm = useCallback(async () => {
        if (!orphans || orphans.length === 0) return;

        // Detonate on success, not on tap. Unlike the shopping list - which mutates
        // optimistically and lets the laser lead - the server is authoritative here about
        // what actually died, so a failed delete never gets a victory lap. The existing
        // spinner covers the wait.
        const result = await deleteOrphanItems.mutateAsync({
            storeId,
            itemIds: orphans.map((item) => item.id),
        });

        await triggerStrike(munition);

        const spared =
            result.skippedCount > 0
                ? ` ${result.skippedCount} spared — claimed since you looked.`
                : "";

        dismissTimeoutRef.current = setTimeout(() => {
            if (result.deletedCount > 0) {
                showSuccess(
                    `${munition.label} confirmed. ${result.deletedCount} ${pluralize("item", result.deletedCount)} obliterated.${spared}`
                );
            } else {
                showInfo(`Strike authorized. Nothing left to hit.${spared}`);
            }
            dismissTimeoutRef.current = null;
            onClose();
        }, munition.duration - DISMISS_LEAD_MS);
    }, [
        orphans,
        deleteOrphanItems,
        storeId,
        munition,
        triggerStrike,
        showSuccess,
        showInfo,
        onClose,
    ]);

    return (
        // Dismissing mid-request would leave the user unsure whether the delete landed, so the
        // backdrop is locked while it is in flight — matching the disabled close button.
        <IonModal isOpen={isOpen} onDidDismiss={onClose} backdropDismiss={!isWorking}>
            <ModalHeader title="Obliterate Unused" onClose={onClose} closeDisabled={isWorking} />

            <IonContent
                className={clsx(
                    "obliterate-sheet-content",
                    isDetonating && "obliterate-sheet-content--detonating"
                )}
            >
                {isLoading ? (
                    <LoadingRows />
                ) : count === 0 ? (
                    <TabEmptyState
                        icon={shieldCheckmarkOutline}
                        title="Orbit is quiet"
                        body="Every uncategorized item is favorited or on somebody's list. The platform stands down."
                        variant="full"
                    />
                ) : (
                    <div className="obliterate-manifest">
                        <h2 className="ruled-label obliterate-manifest__label">
                            <span className="obliterate-manifest__munition">{munition.label}</span>
                            <span className="ruled-label__count">
                                {count} {pluralize("target", count)}
                            </span>
                        </h2>
                        <RobotLine>
                            Coordinates locked. Nothing below is favorited, listed, or spoken for
                            &mdash; and nobody will file a complaint, because nobody remembers
                            creating them.
                        </RobotLine>
                        <HazardRule />
                        <ol className="obliterate-targets">
                            {orphans?.map((item, index) => (
                                <li key={item.id} className="obliterate-target">
                                    <span className="obliterate-target__num" aria-hidden="true">
                                        {index + 1}
                                    </span>
                                    <span className="obliterate-target__name">{item.name}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
            </IonContent>

            {/* A worded Abort rather than EditorFooter's back arrow: it fills the row alone when
                there is nothing to strike. */}
            <EditorFooter>
                <button
                    type="button"
                    className="obliterate-footer__abort"
                    onClick={onClose}
                    disabled={isWorking}
                >
                    {count === 0 ? "Close" : "Abort"}
                </button>
                {count > 0 && (
                    <IonButton
                        color="danger"
                        expand="block"
                        className="editor-form__submit"
                        onClick={handleConfirm}
                        disabled={isWorking}
                    >
                        {isWorking ? (
                            <>
                                <IonSpinner slot="start" name="dots" />
                                Launching
                            </>
                        ) : (
                            <>
                                <IonIcon slot="start" icon={nuclear} />
                                Authorize strike
                            </>
                        )}
                    </IonButton>
                )}
            </EditorFooter>

            {/* Rendered inside this sheet on purpose: it is an IonModal nested above the
                store-items modal, so an overlay rendered in the parent would paint behind
                it. Staying mounted here also keeps the blast alive for its full duration. */}
            <OverlayAnimation cssClass={cssClass} />
        </IonModal>
    );
};

export default ObliterateUnusedModal;

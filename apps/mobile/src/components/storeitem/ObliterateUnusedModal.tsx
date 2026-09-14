import {
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonNote,
    IonSkeletonText,
    IonSpinner,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import clsx from "clsx";
import { closeOutline, nuclear, shieldCheckmarkOutline } from "ionicons/icons";
import pluralize from "pluralize";
import React, { useCallback, useEffect, useRef } from "react";
import { ANIMATION_EFFECTS } from "../../animations/effects";
import { useDeleteOrphanItems, useOrphanItems } from "../../db/itemHooks";
import { useOverlayAnimation } from "../../hooks/useOverlayAnimation";
import { useToast } from "../../hooks/useToast";
import { OverlayAnimation } from "../shared/OverlayAnimation";
import TabEmptyState from "../shared/TabEmptyState";

import "./ObliterateUnusedModal.scss";

/**
 * Dismiss just before the overlay clears, so the sheet never flickers back into view
 * un-faded between the fallout ending and the modal closing. Derived from the effect
 * rather than hand-copied, so retiming the blast cannot leave this behind.
 */
const SHEET_DISMISS_MS = ANIMATION_EFFECTS.NUCLEAR_DETONATION.duration - 50;

interface ObliterateUnusedModalProps {
    isOpen: boolean;
    onClose: () => void;
    storeId: string;
}

const LoadingRows: React.FC = () => (
    <>
        <div className="obliterate-scanning">Designating targets</div>
        <IonList>
            {[1, 2, 3, 4, 5].map((i) => (
                <IonItem key={i}>
                    <IonLabel>
                        <IonSkeletonText animated style={{ width: "60%" }} />
                    </IonLabel>
                </IonItem>
            ))}
        </IonList>
    </>
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
    const {
        trigger: triggerDetonation,
        isActive: isDetonating,
        cssClass,
    } = useOverlayAnimation(ANIMATION_EFFECTS.NUCLEAR_DETONATION);
    const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

        await triggerDetonation();

        const spared =
            result.skippedCount > 0
                ? ` ${result.skippedCount} spared — claimed since you looked.`
                : "";

        dismissTimeoutRef.current = setTimeout(() => {
            if (result.deletedCount > 0) {
                showSuccess(
                    `Strike confirmed. ${result.deletedCount} ${pluralize("item", result.deletedCount)} obliterated.${spared}`
                );
            } else {
                showInfo(`Nothing obliterated.${spared}`);
            }
            dismissTimeoutRef.current = null;
            onClose();
        }, SHEET_DISMISS_MS);
    }, [orphans, deleteOrphanItems, storeId, triggerDetonation, showSuccess, showInfo, onClose]);

    return (
        // Dismissing mid-request would leave the user unsure whether the delete landed, so the
        // backdrop is locked while it is in flight — matching the disabled close button.
        <IonModal isOpen={isOpen} onDidDismiss={onClose} backdropDismiss={!isWorking}>
            <IonHeader>
                <IonToolbar>
                    <IonIcon
                        slot="start"
                        icon={nuclear}
                        color="warning"
                        style={{ marginInlineStart: "12px", fontSize: "20px" }}
                    />
                    <IonTitle>Obliterate Unused</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={onClose} disabled={isWorking}>
                            <IonIcon slot="icon-only" icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

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
                    <>
                        <div className="obliterate-manifest">
                            <div className="obliterate-manifest-label">
                                <span>Orbital strike</span>
                                <span aria-hidden="true">&middot;</span>
                                <span>
                                    {count} {pluralize("target", count)}
                                </span>
                            </div>
                            <p className="obliterate-manifest-note">
                                Coordinates designated from orbit. Nothing below is favorited,
                                listed, or spoken for &mdash; and the platform does not ask twice.
                            </p>
                        </div>
                        <div className="obliterate-hazard-rule" aria-hidden="true" />
                        <IonList>
                            {orphans?.map((item, index) => (
                                <IonItem key={item.id}>
                                    <IonNote slot="start" className="obliterate-row-index">
                                        {String(index + 1).padStart(2, "0")}
                                    </IonNote>
                                    <IonLabel className="ion-text-wrap">{item.name}</IonLabel>
                                </IonItem>
                            ))}
                        </IonList>
                    </>
                )}
            </IonContent>

            <IonFooter>
                <IonToolbar>
                    <IonButtons slot="start">
                        <IonButton onClick={onClose} disabled={isWorking}>
                            {count === 0 ? "Close" : "Abort"}
                        </IonButton>
                    </IonButtons>
                    {count > 0 && (
                        <IonButtons slot="end">
                            <IonButton color="danger" onClick={handleConfirm} disabled={isWorking}>
                                {isWorking ? (
                                    <>
                                        <IonSpinner name="dots" />
                                        <span style={{ marginInlineStart: "8px" }}>Launching</span>
                                    </>
                                ) : (
                                    <>
                                        <IonIcon slot="start" icon={nuclear} />
                                        Authorize strike
                                    </>
                                )}
                            </IonButton>
                        </IonButtons>
                    )}
                </IonToolbar>
            </IonFooter>

            {/* Rendered inside this sheet on purpose: it is an IonModal nested above the
                store-items modal, so an overlay rendered in the parent would paint behind
                it. Staying mounted here also keeps the blast alive for its full duration. */}
            <OverlayAnimation cssClass={cssClass} />
        </IonModal>
    );
};

export default ObliterateUnusedModal;

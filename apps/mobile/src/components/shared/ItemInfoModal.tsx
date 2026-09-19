import type { ShoppingListItemWithDetails, StoreItemWithDetails } from "@basket-bot/core";
import { IonContent, IonModal } from "@ionic/react";
import { ModalHeader } from "./ModalHeader";

import "./ItemInfoModal.scss";

type ItemInfoModalProps =
    | {
          isOpen: boolean;
          onClose: () => void;
          mode: "shoppingListItem";
          item: ShoppingListItemWithDetails;
      }
    | {
          isOpen: boolean;
          onClose: () => void;
          mode: "storeItem";
          item: StoreItemWithDetails;
      };

const formatDate = (isoString: string | null | undefined): string => {
    if (!isoString) return "Unknown";
    return new Date(isoString).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    });
};

/** A record's provenance, named as a store item names it; any of it may be unknown. */
type RecordFacts = {
    [K in "createdByName" | "createdAt" | "updatedByName" | "updatedAt"]:
        | StoreItemWithDetails[K]
        | null;
};

/** Who touched a record and when, as one ruled section holding a label / value tally. */
const RecordSection: React.FC<{ heading: string; facts: RecordFacts }> = ({ heading, facts }) => (
    <section className="item-info__section">
        <h2 className="ruled-label">{heading}</h2>
        <dl className="tally">
            <dt className="tally__quiet">Added by</dt>
            <dd>{facts.createdByName ?? "Unknown"}</dd>
            <dt className="tally__quiet">Added</dt>
            <dd>{formatDate(facts.createdAt)}</dd>
            <dt className="tally__quiet">Last updated by</dt>
            <dd>{facts.updatedByName ?? "Unknown"}</dd>
            <dt className="tally__quiet">Last updated</dt>
            <dd>{formatDate(facts.updatedAt)}</dd>
        </dl>
    </section>
);

/** Read-only provenance for an item: who added and last changed it, and when. */
const ItemInfoModal: React.FC<ItemInfoModalProps> = ({ isOpen, onClose, mode, item }) => (
    <IonModal
        isOpen={isOpen}
        onDidDismiss={onClose}
        breakpoints={[0, 0.6, 1]}
        initialBreakpoint={0.6}
    >
        <ModalHeader title="Item Info" onClose={onClose} />
        <IonContent className="item-info">
            {mode === "shoppingListItem" ? (
                <>
                    <RecordSection heading="Shopping list entry" facts={item} />
                    {item.storeItemId !== null && (
                        <RecordSection
                            heading="Store item entry"
                            facts={{
                                createdByName: item.storeItemCreatedByName,
                                createdAt: item.storeItemCreatedAt,
                                updatedByName: item.storeItemUpdatedByName,
                                updatedAt: item.storeItemUpdatedAt,
                            }}
                        />
                    )}
                </>
            ) : (
                <RecordSection heading="Store item entry" facts={item} />
            )}
        </IonContent>
    </IonModal>
);

export default ItemInfoModal;

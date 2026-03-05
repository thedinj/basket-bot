import type { ShoppingListItemWithDetails, StoreItemWithDetails } from "@basket-bot/core";
import { IonItem, IonLabel, IonList, IonListHeader, IonNote } from "@ionic/react";
import ConfirmModal from "./ConfirmModal";

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

const ItemInfoModal: React.FC<ItemInfoModalProps> = ({ isOpen, onClose, mode, item }) => {
    const content =
        mode === "shoppingListItem" ? (
            <>
                <IonList>
                    <IonListHeader>
                        <IonLabel>Shopping List Entry</IonLabel>
                    </IonListHeader>
                    <IonItem>
                        <IonLabel>
                            <h3>Added by</h3>
                            <p>{item.createdByName ?? "Unknown"}</p>
                        </IonLabel>
                        <IonNote slot="end">{formatDate(item.createdAt)}</IonNote>
                    </IonItem>
                    <IonItem>
                        <IonLabel>
                            <h3>Last updated by</h3>
                            <p>{item.updatedByName ?? "Unknown"}</p>
                        </IonLabel>
                        <IonNote slot="end">{formatDate(item.updatedAt)}</IonNote>
                    </IonItem>
                </IonList>

                {item.storeItemId !== null && (
                    <IonList>
                        <IonListHeader>
                            <IonLabel>Store Item Entry</IonLabel>
                        </IonListHeader>
                        <IonItem>
                            <IonLabel>
                                <h3>Added by</h3>
                                <p>{item.storeItemCreatedByName ?? "Unknown"}</p>
                            </IonLabel>
                            <IonNote slot="end">{formatDate(item.storeItemCreatedAt)}</IonNote>
                        </IonItem>
                        <IonItem>
                            <IonLabel>
                                <h3>Last updated by</h3>
                                <p>{item.storeItemUpdatedByName ?? "Unknown"}</p>
                            </IonLabel>
                            <IonNote slot="end">{formatDate(item.storeItemUpdatedAt)}</IonNote>
                        </IonItem>
                    </IonList>
                )}
            </>
        ) : (
            <IonList>
                <IonItem>
                    <IonLabel>
                        <h3>Added by</h3>
                        <p>{item.createdByName ?? "Unknown"}</p>
                    </IonLabel>
                    <IonNote slot="end">{formatDate(item.createdAt)}</IonNote>
                </IonItem>
                <IonItem>
                    <IonLabel>
                        <h3>Last updated by</h3>
                        <p>{item.updatedByName ?? "Unknown"}</p>
                    </IonLabel>
                    <IonNote slot="end">{formatDate(item.updatedAt)}</IonNote>
                </IonItem>
            </IonList>
        );

    return (
        <ConfirmModal
            isOpen={isOpen}
            onDidDismiss={onClose}
            title="Item Info"
            message={content}
            showCancel={false}
            confirmText="Close"
            onConfirm={onClose}
        />
    );
};

export default ItemInfoModal;

import type { ShoppingListItemWithDetails, StoreItemWithDetails } from "@basket-bot/core";
import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonModal,
    IonNote,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";

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
    return (
        <IonModal
            isOpen={isOpen}
            onDidDismiss={onClose}
            breakpoints={[0, 0.5, 0.75]}
            initialBreakpoint={0.5}
        >
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Item Info</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={onClose}>
                            <IonIcon slot="icon-only" icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent>
                {mode === "shoppingListItem" ? (
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
                                    <IonNote slot="end">
                                        {formatDate(item.storeItemCreatedAt)}
                                    </IonNote>
                                </IonItem>
                                <IonItem>
                                    <IonLabel>
                                        <h3>Last updated by</h3>
                                        <p>{item.storeItemUpdatedByName ?? "Unknown"}</p>
                                    </IonLabel>
                                    <IonNote slot="end">
                                        {formatDate(item.storeItemUpdatedAt)}
                                    </IonNote>
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
                )}
            </IonContent>
        </IonModal>
    );
};

export default ItemInfoModal;

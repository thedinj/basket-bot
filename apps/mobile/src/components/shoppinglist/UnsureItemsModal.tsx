import type { ShoppingListItemWithDetails } from "@basket-bot/core";
import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItemDivider,
    IonLabel,
    IonModal,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import React, { Suspense, useCallback, useMemo } from "react";
import {
    useDeleteShoppingListItem,
    useShoppingListItemsAllStores,
    useUpsertShoppingListItem,
} from "../../db/hooks";
import { queryKeys } from "../../db/queryKeys";
import RefreshConfig from "../../hooks/refresh/RefreshConfig";
import { toUpsertPayload } from "../../utils/shoppingListItemPayload";
import { useAppHeader } from "../layout/useAppHeader";
import { GroupedItemList } from "../shared/GroupedItemList";
import { ItemGroup } from "../shared/grouping.types";
import { ItemEditorModal } from "./ItemEditorModal";
import { ShoppingListItem } from "./ShoppingListItem";
import { ShoppingListProvider } from "./ShoppingListProvider";

const UnsureItemsModalContent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const storesWithItems = useShoppingListItemsAllStores();
    const upsertItem = useUpsertShoppingListItem();
    const deleteItem = useDeleteShoppingListItem();

    const groups = useMemo<ItemGroup<ShoppingListItemWithDetails>[]>(() => {
        return storesWithItems
            .map(({ store, items }, index) => {
                const unsureItems = items.filter((item) => !item.isChecked && item.isUnsure);
                return {
                    id: `store-${store.id}`,
                    items: unsureItems,
                    header: {
                        label: store.name,
                        sticky: true,
                    },
                    sortOrder: index,
                } satisfies ItemGroup<ShoppingListItemWithDetails>;
            })
            .filter((group) => group.items.length > 0);
    }, [storesWithItems]);

    const getItemKey = (item: ShoppingListItemWithDetails) => item.id;
    const handleConfirmUnsure = useCallback(
        (item: ShoppingListItemWithDetails) => {
            upsertItem.mutate(toUpsertPayload(item, { isUnsure: false }));
        },
        [upsertItem]
    );
    const handleRejectUnsure = useCallback(
        (item: ShoppingListItemWithDetails) => {
            deleteItem.mutate({ id: item.id, storeId: item.storeId });
        },
        [deleteItem]
    );
    const renderItem = (item: ShoppingListItemWithDetails) => (
        <ShoppingListItem
            key={item.id}
            item={item}
            isChecked={false}
            onConfirmUnsure={() => handleConfirmUnsure(item)}
            isConfirmingUnsure={upsertItem.isPending && upsertItem.variables?.id === item.id}
            onRejectUnsure={() => handleRejectUnsure(item)}
            isRejectingUnsure={deleteItem.isPending && deleteItem.variables?.id === item.id}
        />
    );

    return (
        <ShoppingListProvider>
            <RefreshConfig
                queryKeys={storesWithItems.map(({ store }) =>
                    queryKeys.shoppingListItems.byStore(store.id)
                )}
            >
                <IonHeader>
                    <IonToolbar>
                        <IonTitle>Unsure Items</IonTitle>
                        <IonButtons slot="end">
                            <IonButton onClick={onClose}>
                                <IonIcon icon={closeOutline} />
                            </IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>
                <IonContent fullscreen>
                    <GroupedItemList<ShoppingListItemWithDetails>
                        groups={groups}
                        renderItem={renderItem}
                        getItemKey={getItemKey}
                        emptyMessage="No unsure items — nice and tidy."
                    />
                </IonContent>
                <ItemEditorModal storeId={storesWithItems[0]?.store.id ?? ""} />
            </RefreshConfig>
        </ShoppingListProvider>
    );
};

const LoadingFallback: React.FC = () => (
    <>
        <IonHeader>
            <IonToolbar>
                <IonTitle>Unsure Items</IonTitle>
            </IonToolbar>
        </IonHeader>
        <IonContent fullscreen>
            <IonItemDivider>
                <IonLabel>
                    <IonSkeletonText animated style={{ width: "80px" }} />
                </IonLabel>
            </IonItemDivider>
        </IonContent>
    </>
);

export const UnsureItemsModal: React.FC = () => {
    const { isModalOpen, closeModal } = useAppHeader();
    const isOpen = isModalOpen("unsureItems");

    return (
        <IonModal isOpen={isOpen} onDidDismiss={closeModal}>
            {isOpen && (
                <Suspense fallback={<LoadingFallback />}>
                    <UnsureItemsModalContent onClose={closeModal} />
                </Suspense>
            )}
        </IonModal>
    );
};

export default UnsureItemsModal;

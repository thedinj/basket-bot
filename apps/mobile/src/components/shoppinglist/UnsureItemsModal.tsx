import type { ShoppingListItemWithDetails } from "@basket-bot/core";
import { IonContent, IonModal } from "@ionic/react";
import { checkmarkDoneOutline } from "ionicons/icons";
import React, { Suspense, useCallback, useMemo } from "react";
import {
    useDeleteShoppingListItem,
    useShoppingListItemsAllStores,
    useUpsertShoppingListItem,
} from "../../db/hooks";
import { queryKeys } from "../../db/queryKeys";
import RefreshConfig from "../../hooks/refresh/RefreshConfig";
import { isPendingUnsure } from "../../utils/shoppingListDerivations";
import { toUpsertPayload } from "../../utils/shoppingListItemPayload";
import { useAppHeader } from "../layout/useAppHeader";
import { GroupedItemList } from "../shared/GroupedItemList";
import { ItemGroup } from "../shared/grouping.types";
import { ModalHeader } from "../shared/ModalHeader";
import RobotLoadingContent from "../shared/RobotLoadingContent";
import TabEmptyState from "../shared/TabEmptyState";
import { ItemEditorModal } from "./ItemEditorModal";
import { ShoppingListItem } from "./ShoppingListItem";
import { ShoppingListProvider } from "./ShoppingListProvider";

import "./UnsureItemsModal.scss";

const MODAL_TITLE = "Review Unsure Items";

// A store heading is the section register (a lilac ruled label), pulled onto the gutter.
const STORE_LABEL_CLASS = "group-header-label group-header-label--section unsure-review__store";

const UnsureItemsModalContent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const storesWithItems = useShoppingListItemsAllStores();
    const upsertItem = useUpsertShoppingListItem();
    const deleteItem = useDeleteShoppingListItem();

    const groups = useMemo<ItemGroup<ShoppingListItemWithDetails>[]>(() => {
        return storesWithItems
            .map(({ store, items }, index) => {
                const unsureItems = items.filter(isPendingUnsure);
                return {
                    id: `store-${store.id}`,
                    items: unsureItems,
                    header: {
                        label: (
                            <>
                                {store.name}
                                <span className="group-header-count">{unsureItems.length}</span>
                            </>
                        ),
                        labelClassName: STORE_LABEL_CLASS,
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
                <ModalHeader title={MODAL_TITLE} onClose={onClose} />
                <IonContent>
                    {groups.length === 0 ? (
                        <TabEmptyState
                            variant="full"
                            icon={checkmarkDoneOutline}
                            title="Nothing to review"
                            body="No unsure items — nice and tidy."
                        />
                    ) : (
                        <GroupedItemList<ShoppingListItemWithDetails>
                            groups={groups}
                            renderItem={renderItem}
                            getItemKey={getItemKey}
                        />
                    )}
                </IonContent>
                <ItemEditorModal storeId={storesWithItems[0]?.store.id ?? ""} />
            </RefreshConfig>
        </ShoppingListProvider>
    );
};

const LoadingFallback: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <>
        <ModalHeader title={MODAL_TITLE} onClose={onClose} />
        <IonContent>
            <div className="unsure-review__loading">
                <RobotLoadingContent />
            </div>
        </IonContent>
    </>
);

export const UnsureItemsModal: React.FC = () => {
    const { isModalOpen, closeModal } = useAppHeader();
    const isOpen = isModalOpen("unsureItems");

    return (
        <IonModal isOpen={isOpen} onDidDismiss={closeModal}>
            {isOpen && (
                <Suspense fallback={<LoadingFallback onClose={closeModal} />}>
                    <UnsureItemsModalContent onClose={closeModal} />
                </Suspense>
            )}
        </IonModal>
    );
};

export default UnsureItemsModal;

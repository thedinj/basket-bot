import { IonPopover } from "@ionic/react";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { useAuth } from "../../auth/useAuth";
import { ItemFlagTile } from "./ItemFlagTile";
import { useItemEditorContext } from "./useItemEditorContext";

export const PrivateToggle = () => {
    const { control, editingItem } = useItemEditorContext();
    const { user } = useAuth();
    const currentUserId = user?.id;
    const [popoverEvent, setPopoverEvent] = useState<unknown>(undefined);
    const [showPopover, setShowPopover] = useState(false);

    const canTogglePrivate = !editingItem || editingItem.createdById === currentUserId;
    const creatorName = editingItem?.createdByName ?? "the item's creator";
    const disabledMessage =
        `Only ${creatorName} can toggle this — an eyes-only item is visible to its creator ` +
        "and nobody else. Add your own copy to control it.";

    return (
        <>
            <Controller
                name="isPrivate"
                control={control}
                render={({ field }) => (
                    <ItemFlagTile
                        src="/img/private.svg"
                        label="Eyes only"
                        description="Eyes only — hidden from everyone else on this store"
                        checked={field.value ?? false}
                        onChange={field.onChange}
                        tone="classified"
                        disabled={!canTogglePrivate}
                        disabledMessage={disabledMessage}
                        onDisabledTap={(event) => {
                            setPopoverEvent(event);
                            setShowPopover(true);
                        }}
                    />
                )}
            />
            <IonPopover
                event={popoverEvent}
                isOpen={showPopover}
                onDidDismiss={() => setShowPopover(false)}
                side="top"
                alignment="center"
                className="item-flag-popover"
            >
                <p className="item-flag-popover__text">{disabledMessage}</p>
            </IonPopover>
        </>
    );
};

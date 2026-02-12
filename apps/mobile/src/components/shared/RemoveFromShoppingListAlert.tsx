import { IonAlert } from "@ionic/react";
import React from "react";

interface RemoveFromShoppingListAlertProps {
    isOpen: boolean;
    itemName?: string;
    onCancel: () => void;
    onRemove: () => void;
}

const RemoveFromShoppingListAlert: React.FC<RemoveFromShoppingListAlertProps> = ({
    isOpen,
    itemName,
    onCancel,
    onRemove,
}) => (
    <IonAlert
        isOpen={isOpen}
        onDidDismiss={onCancel}
        header="Remove from Shopping List?"
        message={itemName ? `Remove "${itemName}" from your shopping list?` : ""}
        buttons={[
            {
                text: "Cancel",
                role: "cancel",
            },
            {
                text: "Remove",
                role: "destructive",
                handler: onRemove,
            },
        ]}
    />
);

export default RemoveFromShoppingListAlert;

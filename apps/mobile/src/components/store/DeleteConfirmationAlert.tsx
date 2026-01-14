import { IonAlert } from "@ionic/react";
import { useStoreManagement } from "./StoreManagementContext";
import { useDeleteAisle, useDeleteSection } from "../../db/hooks";

interface DeleteConfirmationAlertProps {
    storeId: string;
}

export const DeleteConfirmationAlert = ({
    storeId,
}: DeleteConfirmationAlertProps) => {
    const { deleteAlert, closeDeleteAlert } = useStoreManagement();
    const deleteAisle = useDeleteAisle();
    const deleteSection = useDeleteSection();

    const handleDelete = async () => {
        if (!deleteAlert) return;

        if (deleteAlert.type === "aisle") {
            await deleteAisle.mutateAsync({ id: deleteAlert.id, storeId });
        } else {
            await deleteSection.mutateAsync({ id: deleteAlert.id, storeId });
        }
        closeDeleteAlert();
    };

    const getDeleteMessage = () => {
        if (!deleteAlert) return "";

        if (deleteAlert.type === "aisle") {
            return `Are you sure you want to delete "${deleteAlert.name}"? This will also delete all sections in this aisle.`;
        }
        return `Are you sure you want to delete "${deleteAlert.name}"?`;
    };

    return (
        <IonAlert
            isOpen={!!deleteAlert}
            onDidDismiss={closeDeleteAlert}
            header={`Delete ${
                deleteAlert?.type === "aisle" ? "Aisle" : "Section"
            }`}
            message={getDeleteMessage()}
            buttons={[
                {
                    text: "Cancel",
                    role: "cancel",
                },
                {
                    text: "Delete",
                    role: "destructive",
                    handler: handleDelete,
                },
            ]}
        />
    );
};

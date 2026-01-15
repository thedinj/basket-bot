import { ReactNode, useState } from "react";
import {
    DeleteEntity,
    EditingEntity,
    EntityType,
    ReorderMode,
    StoreManagementContext,
    StoreManagementContextType,
} from "./StoreManagementContext";

interface StoreManagementProviderProps {
    children: ReactNode;
}

export const StoreManagementProvider = ({ children }: StoreManagementProviderProps) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEntity, setEditingEntity] = useState<EditingEntity | null>(null);
    const [forcedType, setForcedType] = useState<EntityType | null>(null);
    const [deleteAlert, setDeleteAlert] = useState<DeleteEntity | null>(null);
    const [mode, setMode] = useState<ReorderMode>("sections");

    const openCreateModal = (forceType?: EntityType) => {
        setEditingEntity(null);
        setForcedType(forceType || null);
        setIsModalOpen(true);
    };

    const openEditAisleModal = (aisle: { id: string; name: string }) => {
        setEditingEntity({ ...aisle, type: "aisle" });
        setIsModalOpen(true);
    };

    const openEditSectionModal = (section: { id: string; name: string; aisleId: string }) => {
        setEditingEntity({ ...section, type: "section" });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingEntity(null);
        setForcedType(null);
    };

    const confirmDeleteAisle = (aisle: { id: string; name: string }) => {
        setDeleteAlert({ ...aisle, type: "aisle" });
    };

    const confirmDeleteSection = (section: { id: string; name: string }) => {
        setDeleteAlert({ ...section, type: "section" });
    };

    const closeDeleteAlert = () => {
        setDeleteAlert(null);
    };

    const value: StoreManagementContextType = {
        isModalOpen,
        editingEntity,
        forcedType,
        openCreateModal,
        openEditAisleModal,
        openEditSectionModal,
        closeModal,
        deleteAlert,
        confirmDeleteAisle,
        confirmDeleteSection,
        closeDeleteAlert,
        mode,
        setMode,
    };

    return (
        <StoreManagementContext.Provider value={value}>{children}</StoreManagementContext.Provider>
    );
};

import { PropsWithChildren, useCallback, useMemo, useState } from "react";
import { AppHeaderContext, type ModalName } from "./AppHeaderContext";

export const AppHeaderProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const [currentModal, setCurrentModal] = useState<ModalName | null>(null);
    const openModal = useCallback((name: ModalName) => {
        setCurrentModal(name);
    }, []);

    const closeModal = useCallback(() => {
        setCurrentModal(null);
    }, []);

    const isModalOpen = useCallback((name: ModalName) => currentModal === name, [currentModal]);

    const value = useMemo(
        () => ({
            currentModal,
            openModal,
            closeModal,
            isModalOpen,
        }),
        [currentModal, openModal, closeModal, isModalOpen]
    );

    return <AppHeaderContext.Provider value={value}>{children}</AppHeaderContext.Provider>;
};

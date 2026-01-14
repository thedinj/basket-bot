import { useContext } from "react";
import { AppHeaderContext } from "./AppHeaderContext";

export const useAppHeader = () => {
    const context = useContext(AppHeaderContext);
    if (!context) {
        throw new Error("useAppHeader must be used within AppHeaderProvider");
    }
    return context;
};

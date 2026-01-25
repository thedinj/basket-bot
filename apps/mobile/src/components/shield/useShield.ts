import { useContext } from "react";
import { ShieldContext } from "./ShieldContext";

export const useShield = () => {
    const context = useContext(ShieldContext);
    if (!context) {
        throw new Error("useShield must be used within ShieldProvider");
    }
    return context;
};

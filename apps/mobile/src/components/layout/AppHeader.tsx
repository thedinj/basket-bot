import {
    IonBackButton,
    IonButton,
    IonButtons,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonMenuButton,
    IonPopover,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { ellipsisVertical } from "ionicons/icons";
import { useState } from "react";
import { PageMenuItemConfig } from "./AppHeaderContext";

interface AppHeaderProps {
    title: string | React.ReactNode;
    showBackButton?: boolean;
    backButtonHref?: string;
    children?: React.ReactNode;
    menuItems?: PageMenuItemConfig[];
}

export const AppHeader: React.FC<AppHeaderProps> = ({
    title,
    showBackButton = false,
    backButtonHref,
    children,
    menuItems = [],
}) => {
    const [showPageMenu, setShowPageMenu] = useState(false);
    const [popoverEvent, setPopoverEvent] = useState<unknown>(undefined);

    return (
        <IonHeader>
            <IonToolbar>
                <IonButtons slot="start">
                    <IonMenuButton />
                    {showBackButton && <IonBackButton defaultHref={backButtonHref} />}
                </IonButtons>
                <IonTitle>{title}</IonTitle>
                <IonButtons slot="end">
                    {children}
                    {menuItems.length > 0 && (
                        <>
                            <IonButton
                                onClick={(e) => {
                                    setPopoverEvent(e);
                                    setShowPageMenu(true);
                                }}
                            >
                                <IonIcon slot="icon-only" icon={ellipsisVertical} />
                            </IonButton>
                            <IonPopover
                                event={popoverEvent}
                                isOpen={showPageMenu}
                                onDidDismiss={() => setShowPageMenu(false)}
                                side="bottom"
                                alignment="end"
                            >
                                <IonList>
                                    {menuItems.map((item) => (
                                        <IonItem
                                            key={item.id}
                                            button
                                            onClick={() => {
                                                item.onClick();
                                                setShowPageMenu(false);
                                            }}
                                            lines="none"
                                            disabled={item.disabled}
                                        >
                                            <IonIcon
                                                icon={item.icon}
                                                slot="start"
                                                color={item.color}
                                            />
                                            <IonLabel color={item.color}>{item.label}</IonLabel>
                                        </IonItem>
                                    ))}
                                </IonList>
                            </IonPopover>
                        </>
                    )}
                </IonButtons>
            </IonToolbar>
        </IonHeader>
    );
};

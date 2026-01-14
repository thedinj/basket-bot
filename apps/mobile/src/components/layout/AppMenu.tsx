import {
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonMenu,
    IonMenuToggle,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { settings } from "ionicons/icons";
import { useAppHeader } from "./useAppHeader";

export const AppMenu: React.FC = () => {
    const { openSettings } = useAppHeader();

    return (
        <IonMenu contentId="main-content" type="overlay">
            <IonHeader>
                <IonToolbar>
                    <IonTitle>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                            }}
                        >
                            <img
                                src="/img/icon.png"
                                alt="Basket Bot"
                                style={{
                                    width: "32px",
                                    height: "32px",
                                    borderRadius: "50%",
                                    objectFit: "cover",
                                }}
                            />
                            <span>Basket Bot</span>
                        </div>
                    </IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent>
                <IonList>
                    <IonMenuToggle autoHide={false}>
                        <IonItem button onClick={openSettings} lines="none">
                            <IonIcon icon={settings} slot="start" />
                            <IonLabel>Settings</IonLabel>
                        </IonItem>
                    </IonMenuToggle>
                </IonList>
            </IonContent>
        </IonMenu>
    );
};

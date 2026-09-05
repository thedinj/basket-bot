import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonModal,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { useAppHeader } from "../layout/useAppHeader";
import AboutSection from "./AboutSection";

const AboutModal: React.FC = () => {
    const { isModalOpen, closeModal } = useAppHeader();

    return (
        <IonModal isOpen={isModalOpen("about")} onDidDismiss={closeModal}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>About</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={closeModal}>
                            <IonIcon icon={closeOutline} />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "12px",
                        padding: "24px 16px",
                    }}
                >
                    <img
                        src="/img/icon.png"
                        alt="Basket Bot"
                        style={{
                            width: "72px",
                            height: "72px",
                            borderRadius: "50%",
                            objectFit: "cover",
                        }}
                    />
                    <div style={{ fontSize: "20px", fontWeight: "600" }}>Basket Bot</div>
                    <div style={{ fontSize: "14px", color: "var(--ion-color-medium)" }}>
                        I'll be back. With the milk.
                    </div>
                </div>

                <AboutSection />

                <div
                    style={{
                        textAlign: "center",
                        padding: "24px 16px",
                        fontSize: "13px",
                        color: "var(--ion-color-medium)",
                    }}
                >
                    Created by thedinj@gmail.com
                </div>
            </IonContent>
        </IonModal>
    );
};

export default AboutModal;

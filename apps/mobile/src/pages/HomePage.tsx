import {
    IonContent,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
} from "@ionic/react";
import "./HomePage.scss";

const HomePage: React.FC = () => {
    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Basket Bot</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen>
                <IonHeader collapse="condense">
                    <IonToolbar>
                        <IonTitle size="large">Basket Bot</IonTitle>
                    </IonToolbar>
                </IonHeader>
                <div className="home-container">
                    <IonCard>
                        <IonCardHeader>
                            <IonCardTitle>Welcome</IonCardTitle>
                        </IonCardHeader>
                        <IonCardContent>
                            <p>Shopping list management made easy.</p>
                            <IonButton expand="block" className="ion-margin-top">
                                Get Started
                            </IonButton>
                        </IonCardContent>
                    </IonCard>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default HomePage;

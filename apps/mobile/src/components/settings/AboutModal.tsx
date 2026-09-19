import { IonContent, IonModal } from "@ionic/react";
import { useAppHeader } from "../layout/useAppHeader";
import { ModalHeader } from "../shared/ModalHeader";
import AboutSection from "./AboutSection";

import "./AboutModal.scss";

const AboutModal: React.FC = () => {
    const { isModalOpen, closeModal } = useAppHeader();

    return (
        <IonModal isOpen={isModalOpen("about")} onDidDismiss={closeModal}>
            <ModalHeader title="About" onClose={closeModal} />
            <IonContent className="about-content">
                <header className="about-hero">
                    {/* The name sits right beside it, so the mark itself is decorative. */}
                    <img className="about-hero__icon" src="/img/icon.png" alt="" />
                    <div className="about-hero__text">
                        <h1 className="about-hero__name">Basket Bot</h1>
                        <p className="about-hero__tagline">I&apos;ll be back. With the milk.</p>
                    </div>
                </header>

                <AboutSection />
            </IonContent>
        </IonModal>
    );
};

export default AboutModal;

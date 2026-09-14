import { IonIcon, IonItem, IonLabel, IonList } from "@ionic/react";
import { nuclear, pulseOutline } from "ionicons/icons";
import { useState } from "react";
import BlackBoxModal from "./BlackBoxModal";
import StrikeRangeModal from "./StrikeRangeModal";

const DEBUG_UNLOCK_TAPS = 7;

/**
 * About panel shown in the About modal (app menu > About). Tapping the build row 7x unlocks the
 * hidden developer tools (standard "developer options" convention) for the rest of the session,
 * without needing a separate discoverable menu entry.
 *
 * Both tools open in their own modal rather than expanding inline: the error log used to render
 * its full list here and push the About footer off the bottom of the screen.
 */
const AboutSection: React.FC = () => {
    const [tapCount, setTapCount] = useState(0);
    const [debugUnlocked, setDebugUnlocked] = useState(false);
    const [isStrikeRangeOpen, setIsStrikeRangeOpen] = useState(false);
    const [isBlackBoxOpen, setIsBlackBoxOpen] = useState(false);

    const handleVersionTap = () => {
        if (debugUnlocked) return;
        const nextCount = tapCount + 1;
        if (nextCount >= DEBUG_UNLOCK_TAPS) {
            setDebugUnlocked(true);
        } else {
            setTapCount(nextCount);
        }
    };

    return (
        <>
            <IonList>
                <IonItem button detail={false} onClick={handleVersionTap}>
                    <IonLabel>
                        <p>
                            Build {import.meta.env.VITE_GIT_HASH} ·{" "}
                            {new Date(import.meta.env.VITE_BUILD_TIME).toLocaleString()}
                        </p>
                    </IonLabel>
                </IonItem>
                {debugUnlocked && (
                    <>
                        <IonItem button detail onClick={() => setIsStrikeRangeOpen(true)}>
                            <IonIcon slot="start" icon={nuclear} color="warning" />
                            <IonLabel>
                                <h3>Strike range</h3>
                                <p>Fire every obliteration animation</p>
                            </IonLabel>
                        </IonItem>
                        <IonItem button detail onClick={() => setIsBlackBoxOpen(true)}>
                            <IonIcon slot="start" icon={pulseOutline} color="warning" />
                            <IonLabel>
                                <h3>Black box</h3>
                                <p>Recent errors recorded on this device</p>
                            </IonLabel>
                        </IonItem>
                    </>
                )}
            </IonList>

            <StrikeRangeModal
                isOpen={isStrikeRangeOpen}
                onClose={() => setIsStrikeRangeOpen(false)}
            />
            <BlackBoxModal isOpen={isBlackBoxOpen} onClose={() => setIsBlackBoxOpen(false)} />
        </>
    );
};

export default AboutSection;

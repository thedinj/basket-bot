import { IonItem, IonLabel, IonList } from "@ionic/react";
import { useState } from "react";
import DebugLogView from "./DebugLogView";

const DEBUG_UNLOCK_TAPS = 7;

/**
 * About panel shown in Settings. Tapping the version 7x unlocks the hidden
 * debug log (standard "developer options" convention) for the rest of the
 * session, without needing a separate discoverable menu entry.
 */
const AboutSection: React.FC = () => {
    const [tapCount, setTapCount] = useState(0);
    const [debugUnlocked, setDebugUnlocked] = useState(false);

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
        <IonList>
            <IonItem button detail={false} onClick={handleVersionTap}>
                <IonLabel>
                    <p>
                        Build {import.meta.env.VITE_GIT_HASH} ·{" "}
                        {new Date(import.meta.env.VITE_BUILD_TIME).toLocaleString()}
                    </p>
                </IonLabel>
            </IonItem>
            {debugUnlocked && <DebugLogView />}
        </IonList>
    );
};

export default AboutSection;

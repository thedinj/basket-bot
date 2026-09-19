import { IonIcon } from "@ionic/react";
import { chevronForward, nuclear, pulseOutline } from "ionicons/icons";
import { useState } from "react";
import BlackBoxModal from "./BlackBoxModal";
import StrikeRangeModal from "./StrikeRangeModal";

import "./AboutModal.scss";

const DEBUG_UNLOCK_TAPS = 7;

const BUILD_TIME = new Date(import.meta.env.VITE_BUILD_TIME).toLocaleString();

const DeveloperTool: React.FC<{ icon: string; name: string; hint: string; onOpen: () => void }> = ({
    icon,
    name,
    hint,
    onOpen,
}) => (
    <li>
        <button type="button" className="row-button about-tools__row" onClick={onOpen}>
            <IonIcon className="about-tools__icon" icon={icon} aria-hidden="true" />
            <span className="about-tools__text">
                <span className="about-tools__name">{name}</span>
                <span className="about-tools__hint">{hint}</span>
            </span>
            <IonIcon className="about-tools__chevron" icon={chevronForward} aria-hidden="true" />
        </button>
    </li>
);

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
            <section className="about-section">
                <h2 className="ruled-label">Build</h2>
                <dl className="tally">
                    <dt className="tally__quiet">Version</dt>
                    <dd>{import.meta.env.VITE_APP_VERSION}</dd>
                    {/* The whole row is the tap target: the button's hit area is stretched over
                        it (see .about-tally__tap), so a dl keeps its dt/dd structure. */}
                    <div className="about-tally__tap-row">
                        <dt className="tally__quiet">Build</dt>
                        <dd>
                            <button
                                type="button"
                                className="about-tally__tap"
                                onClick={handleVersionTap}
                            >
                                {import.meta.env.VITE_GIT_HASH}
                            </button>
                        </dd>
                    </div>
                    <dt className="tally__quiet">Compiled</dt>
                    <dd>{BUILD_TIME}</dd>
                    <dt className="tally__quiet">Created by</dt>
                    <dd>thedinj@gmail.com</dd>
                </dl>
            </section>

            {debugUnlocked && (
                <section className="about-section">
                    <h2 className="ruled-label">Developer tools</h2>
                    <ul className="gutter-rows about-tools">
                        <DeveloperTool
                            icon={nuclear}
                            name="Strike range"
                            hint="Fire every obliteration animation"
                            onOpen={() => setIsStrikeRangeOpen(true)}
                        />
                        <DeveloperTool
                            icon={pulseOutline}
                            name="Black box"
                            hint="Recent errors recorded on this device"
                            onOpen={() => setIsBlackBoxOpen(true)}
                        />
                    </ul>
                </section>
            )}

            <StrikeRangeModal
                isOpen={isStrikeRangeOpen}
                onClose={() => setIsStrikeRangeOpen(false)}
            />
            <BlackBoxModal isOpen={isBlackBoxOpen} onClose={() => setIsBlackBoxOpen(false)} />
        </>
    );
};

export default AboutSection;

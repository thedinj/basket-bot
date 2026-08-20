import { IonChip, IonDatetime, IonIcon, IonLabel, IonModal } from "@ionic/react";
import { closeCircle } from "ionicons/icons";
import { useMemo, useState } from "react";
import { formatSnoozeDate, formatSnoozeDateForStorage } from "../../utils/dateUtils";
import "./SnoozeChips.scss";

/** Preset snooze offsets, in days from today. Shared with the swipe-action surface so
 * both agree on what "1 wk" means. */
export const SNOOZE_PRESETS: { label: string; days: number }[] = [
    { label: "Tomorrow", days: 1 },
    { label: "1 wk", days: 7 },
];

interface SnoozeChipsProps {
    value: string | null;
    onChange: (value: string | null) => void;
}

/**
 * Standalone snooze-date control: two one-tap presets plus a "Pick date..." chip that
 * opens the date sheet for anything else. No react-hook-form dependency — usable both
 * inside a Controller (item editor) and driven directly by a mutation (swipe action).
 */
export const SnoozeChips: React.FC<SnoozeChipsProps> = ({ value, onChange }) => {
    const [showModal, setShowModal] = useState(false);

    // Start of tomorrow, the minimum selectable date.
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split("T")[0];

    const presetDates = useMemo(
        () =>
            SNOOZE_PRESETS.map((preset) => {
                const date = new Date();
                date.setHours(0, 0, 0, 0);
                date.setDate(date.getDate() + preset.days);
                return { ...preset, date: formatSnoozeDateForStorage(date.toISOString()) };
            }),
        []
    );

    const isCustom = Boolean(value) && !presetDates.some((preset) => preset.date === value);

    return (
        <div className="snooze-chips">
            <div className="snooze-chips__label">Snooze</div>
            <div className="snooze-chips__row">
                {presetDates.map((preset) => {
                    const isActive = preset.date === value;
                    return (
                        <IonChip
                            key={preset.label}
                            outline={!isActive}
                            color={isActive ? "primary" : "medium"}
                            className="snooze-chips__chip"
                            onClick={() => onChange(preset.date)}
                        >
                            <IonLabel>{preset.label}</IonLabel>
                            {isActive && (
                                <IonIcon
                                    icon={closeCircle}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onChange(null);
                                    }}
                                />
                            )}
                        </IonChip>
                    );
                })}
                {isCustom ? (
                    <IonChip
                        color="primary"
                        className="snooze-chips__chip"
                        onClick={() => setShowModal(true)}
                    >
                        <IonLabel>{formatSnoozeDate(value!)}</IonLabel>
                        <IonIcon
                            icon={closeCircle}
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange(null);
                            }}
                        />
                    </IonChip>
                ) : (
                    <span className="snooze-chips__link" onClick={() => setShowModal(true)}>
                        Pick date...
                    </span>
                )}
            </div>

            <IonModal
                isOpen={showModal}
                onDidDismiss={() => setShowModal(false)}
                initialBreakpoint={0.5}
                breakpoints={[0, 0.5, 0.75]}
            >
                <IonDatetime
                    presentation="date"
                    min={minDate}
                    value={value || undefined}
                    onIonChange={(e) => {
                        const newValue = e.detail.value;
                        if (typeof newValue === "string") {
                            onChange(formatSnoozeDateForStorage(newValue));
                            setShowModal(false);
                        }
                    }}
                />
            </IonModal>
        </div>
    );
};

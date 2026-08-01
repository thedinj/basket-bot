import { IonButton, IonItem, IonLabel, IonNote } from "@ionic/react";
import { useEffect, useState } from "react";
import { useToast } from "../../hooks/useToast";
import { clientErrorLog, type ClientErrorLogEntry } from "../../lib/clientErrorLog";

/**
 * Hidden debug log shown after tapping the app version 7x in Settings > About.
 * Lists recent client-side errors so a requestId can be handed back to an admin
 * to cross-reference against the backend's Error Logs page.
 */
const DebugLogView: React.FC = () => {
    const { showInfo } = useToast();
    const [entries, setEntries] = useState<readonly ClientErrorLogEntry[]>(clientErrorLog.getAll());

    useEffect(() => {
        return clientErrorLog.subscribe(() => setEntries(clientErrorLog.getAll()));
    }, []);

    const handleCopy = async (entry: ClientErrorLogEntry) => {
        const text = [
            new Date(entry.timestamp).toISOString(),
            entry.operation,
            entry.message,
            entry.code ?? entry.status,
            entry.requestId ? `requestId=${entry.requestId}` : null,
        ]
            .filter(Boolean)
            .join(" · ");

        await navigator.clipboard.writeText(text);
        showInfo("Copied to clipboard");
    };

    return (
        <>
            <IonItem lines="none">
                <IonLabel>
                    <h3>Debug Log</h3>
                    <p>Recent errors on this device ({entries.length}). Tap an entry to copy it.</p>
                </IonLabel>
                {entries.length > 0 && (
                    <IonButton
                        slot="end"
                        size="small"
                        fill="clear"
                        onClick={() => clientErrorLog.clear()}
                    >
                        Clear
                    </IonButton>
                )}
            </IonItem>
            {entries.length === 0 && (
                <IonItem lines="none">
                    <IonNote>No errors recorded.</IonNote>
                </IonItem>
            )}
            {entries.map((entry) => (
                <IonItem key={entry.id} button detail={false} onClick={() => handleCopy(entry)}>
                    <IonLabel className="ion-text-wrap">
                        <p>
                            {new Date(entry.timestamp).toLocaleString()}
                            {entry.operation ? ` · ${entry.operation}` : ""}
                        </p>
                        <p>{entry.message}</p>
                        <IonNote style={{ fontSize: "0.75rem" }}>
                            {[entry.code ?? entry.status, entry.requestId]
                                .filter(Boolean)
                                .join(" · ")}
                        </IonNote>
                    </IonLabel>
                </IonItem>
            ))}
        </>
    );
};

export default DebugLogView;

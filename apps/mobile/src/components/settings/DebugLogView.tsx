import { useEffect, useState } from "react";
import { useToast } from "../../hooks/useToast";
import { clientErrorLog, type ClientErrorLogEntry } from "../../lib/clientErrorLog";

import "./DebugLogView.scss";

/**
 * Body of the Black Box modal (app menu > About > 7 taps > Black box).
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
        <section className="debug-log">
            <h2 className="ruled-label">
                Debug log <span className="ruled-label__count">{entries.length}</span>
            </h2>

            <div className="debug-log__toolbar">
                <p className="debug-log__meta">
                    {entries.length === 0
                        ? "No errors recorded."
                        : "Recent errors on this device. Tap an entry to copy it."}
                </p>
                {entries.length > 0 && (
                    <button
                        type="button"
                        className="form-field__action form-field__action--standalone debug-log__clear"
                        onClick={() => clientErrorLog.clear()}
                    >
                        Clear
                    </button>
                )}
            </div>

            {entries.length > 0 && (
                <ol className="gutter-rows gutter-rows--ruled debug-log__entries">
                    {entries.map((entry) => {
                        const codes = [entry.code ?? entry.status, entry.requestId]
                            .filter(Boolean)
                            .join(" · ");
                        return (
                            <li key={entry.id}>
                                <button
                                    type="button"
                                    className="row-button debug-log__entry"
                                    onClick={() => void handleCopy(entry)}
                                >
                                    <span className="debug-log__when">
                                        {new Date(entry.timestamp).toLocaleString()}
                                        {entry.operation ? ` · ${entry.operation}` : ""}
                                    </span>
                                    <span className="debug-log__message">{entry.message}</span>
                                    {codes && <span className="debug-log__codes">{codes}</span>}
                                </button>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
};

export default DebugLogView;

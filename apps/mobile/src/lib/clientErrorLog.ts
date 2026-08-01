import { Preferences } from "@capacitor/preferences";

/**
 * A single recorded client-side error, shown in the hidden debug log
 * (Settings > tap version 7x) so a request can be cross-referenced against
 * the admin portal's Error Logs page by requestId.
 */
export interface ClientErrorLogEntry {
    id: string;
    timestamp: number;
    operation?: string;
    endpoint?: string;
    message: string;
    code?: string;
    status?: number;
    requestId?: string | null;
}

const LOG_STORAGE_KEY = "client_error_log";
const MAX_ENTRIES = 50;

/**
 * ClientErrorLog service
 * Persists recent client-side errors to Capacitor Preferences so they survive
 * app restarts, mirroring the MutationQueue's persistence pattern.
 */
export class ClientErrorLog {
    private entries: ClientErrorLogEntry[] = [];
    private listeners: Set<() => void> = new Set();

    constructor() {
        this.load();
    }

    private async load(): Promise<void> {
        try {
            const { value } = await Preferences.get({ key: LOG_STORAGE_KEY });
            if (value) {
                this.entries = JSON.parse(value);
                this.notifyListeners();
            }
        } catch (error) {
            console.error("[ClientErrorLog] Failed to load log:", error);
            this.entries = [];
        }
    }

    private async save(): Promise<void> {
        try {
            await Preferences.set({
                key: LOG_STORAGE_KEY,
                value: JSON.stringify(this.entries),
            });
        } catch (error) {
            console.error("[ClientErrorLog] Failed to save log:", error);
        }
    }

    async record(entry: Omit<ClientErrorLogEntry, "id" | "timestamp">): Promise<void> {
        this.entries.unshift({
            ...entry,
            id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
            timestamp: Date.now(),
        });
        this.entries = this.entries.slice(0, MAX_ENTRIES);
        await this.save();
        this.notifyListeners();
    }

    getAll(): readonly ClientErrorLogEntry[] {
        return [...this.entries];
    }

    async clear(): Promise<void> {
        this.entries = [];
        await this.save();
        this.notifyListeners();
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notifyListeners(): void {
        this.listeners.forEach((listener) => listener());
    }
}

export const clientErrorLog = new ClientErrorLog();

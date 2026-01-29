import { Preferences } from "@capacitor/preferences";

/**
 * Queued mutation data structure
 */
export interface QueuedMutation {
    id: string;
    timestamp: number;
    operation: string;
    endpoint: string;
    method: string;
    data?: unknown;
    retryCount: number;
    lastError?: string;
}

/**
 * Mutation queue configuration
 */
const QUEUE_STORAGE_KEY = "mutation_queue";
const MAX_RETRY_COUNT = 3;

/**
 * MutationQueue service
 * Persists failed mutations to Capacitor Preferences and retries them
 * on user interaction (manual sync trigger)
 */
export class MutationQueue {
    private queue: QueuedMutation[] = [];
    private listeners: Set<() => void> = new Set();
    private isProcessing = false;

    constructor() {
        this.loadQueue();
    }

    /**
     * Load queue from persistent storage
     */
    private async loadQueue(): Promise<void> {
        try {
            const { value } = await Preferences.get({ key: QUEUE_STORAGE_KEY });
            if (value) {
                this.queue = JSON.parse(value);
                this.notifyListeners();
            }
        } catch (error) {
            console.error("[MutationQueue] Failed to load queue:", error);
            this.queue = [];
        }
    }

    /**
     * Save queue to persistent storage
     */
    private async saveQueue(): Promise<void> {
        try {
            await Preferences.set({
                key: QUEUE_STORAGE_KEY,
                value: JSON.stringify(this.queue),
            });
        } catch (error) {
            console.error("[MutationQueue] Failed to save queue:", error);
        }
    }

    /**
     * Add a mutation to the queue
     */
    async enqueue(
        mutation: Omit<QueuedMutation, "id" | "timestamp" | "retryCount">
    ): Promise<void> {
        const queuedMutation: QueuedMutation = {
            ...mutation,
            id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
            timestamp: Date.now(),
            retryCount: 0,
        };

        this.queue.push(queuedMutation);
        await this.saveQueue();
        this.notifyListeners();
    }

    /**
     * Remove a mutation from the queue
     */
    async dequeue(mutationId: string): Promise<void> {
        this.queue = this.queue.filter((m) => m.id !== mutationId);
        await this.saveQueue();
        this.notifyListeners();
    }

    /**
     * Get all queued mutations (detailed view for review UI)
     */
    getQueue(): readonly QueuedMutation[] {
        return [...this.queue];
    }

    /**
     * Get queue size
     */
    getQueueSize(): number {
        return this.queue.length;
    }

    /**
     * Remove a specific mutation from the queue (manual abort)
     */
    async removeMutation(mutationId: string): Promise<void> {
        await this.dequeue(mutationId);
    }

    /**
     * Clear the entire queue (accept server state - discard conflicting mutations)
     */
    async clearQueue(): Promise<void> {
        this.queue = [];
        await this.saveQueue();
        this.notifyListeners();
    }

    /**
     * Process the queue by replaying mutations
     * Returns the number of successful operations
     */
    async processQueue(
        executor: (mutation: QueuedMutation) => Promise<void>
    ): Promise<{ success: number; failed: number }> {
        if (this.isProcessing) {
            console.warn("[MutationQueue] Already processing queue");
            return { success: 0, failed: 0 };
        }

        this.isProcessing = true;
        let successCount = 0;
        let failedCount = 0;

        try {
            // Process mutations in order (FIFO)
            const mutationsToProcess = [...this.queue];

            for (const mutation of mutationsToProcess) {
                try {
                    await executor(mutation);
                    // Success - remove from queue
                    await this.dequeue(mutation.id);
                    successCount++;
                } catch (error: unknown) {
                    console.error(
                        `[MutationQueue] Failed to process mutation ${mutation.id}:`,
                        error
                    );

                    const errorMessage = error instanceof Error ? error.message : "Unknown error";

                    // Check if this is a permanent failure (4xx error except timeout/rate limit)
                    const isPermanentFailure = this.isPermanentFailure(error);

                    if (isPermanentFailure) {
                        // Accept server state - remove from queue
                        console.warn(
                            `[MutationQueue] Permanent failure for ${mutation.id}, removing from queue`
                        );
                        await this.dequeue(mutation.id);
                        failedCount++;
                    } else {
                        // Increment retry count
                        mutation.retryCount++;
                        mutation.lastError = errorMessage;

                        if (mutation.retryCount >= MAX_RETRY_COUNT) {
                            // Max retries exceeded - remove from queue
                            console.warn(
                                `[MutationQueue] Max retries exceeded for ${mutation.id}, removing from queue`
                            );
                            await this.dequeue(mutation.id);
                            failedCount++;
                        } else {
                            // Update mutation in queue
                            await this.saveQueue();
                            failedCount++;
                        }
                    }
                }
            }
        } finally {
            this.isProcessing = false;
            this.notifyListeners();
        }

        return { success: successCount, failed: failedCount };
    }

    /**
     * Check if an error represents a permanent failure (should not retry)
     */
    private isPermanentFailure(error: unknown): boolean {
        // ApiError with 4xx status (except 408 timeout, 429 rate limit)
        if (error && typeof error === "object" && "status" in error) {
            const status = (error as { status?: number }).status;
            if (status && status >= 400 && status < 500) {
                return status !== 408 && status !== 429;
            }
        }
        return false;
    }

    /**
     * Check if queue is currently being processed
     */
    isProcessingQueue(): boolean {
        return this.isProcessing;
    }

    /**
     * Subscribe to queue changes
     */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Notify all listeners of queue changes
     */
    private notifyListeners(): void {
        this.listeners.forEach((listener) => listener());
    }
}

// Singleton instance
export const mutationQueue = new MutationQueue();

import { useMutation, UseMutationResult } from "@tanstack/react-query";
import { ApiError } from "../lib/api/client";
import { mutationQueue } from "../lib/mutationQueue";

/**
 * Options for queue-aware mutations
 */
export interface QueueableMutationOptions<TData, TVariables> {
    /** The actual mutation function to execute */
    mutationFn: (variables: TVariables) => Promise<TData>;
    /** How to serialize this mutation for the queue */
    toQueuedMutation?: (variables: TVariables) => {
        operation: string;
        endpoint: string;
        method: string;
        data?: unknown;
    };
    /** Standard mutation options */
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
}

/**
 * Wrapper around useMutation that automatically queues failed mutations
 * for retry when network returns
 *
 * If mutation fails with network error and toQueuedMutation is provided,
 * the mutation is added to the persistent queue for later retry
 */
export function useQueueableMutation<TData = unknown, TVariables = unknown>(
    options: QueueableMutationOptions<TData, TVariables>
): UseMutationResult<TData, Error, TVariables> {
    const { mutationFn, toQueuedMutation, onSuccess, onError } = options;

    return useMutation<TData, Error, TVariables>({
        mutationFn,
        onSuccess,
        onError: (error, variables) => {
            // Check if this is a network error that should be queued
            if (toQueuedMutation && error instanceof ApiError && error.isNetworkError) {
                // Queue the mutation for retry
                const queuedMutation = toQueuedMutation(variables);
                mutationQueue.enqueue(queuedMutation).catch((queueError) => {
                    console.error("[useQueueableMutation] Failed to queue mutation:", queueError);
                });
            }

            // Call original error handler
            onError?.(error, variables);
        },
    });
}

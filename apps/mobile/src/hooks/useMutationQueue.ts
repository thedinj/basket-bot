import { useEffect, useState } from "react";
import { mutationQueue } from "../lib/mutationQueue";

/**
 * Hook to access mutation queue state
 */
export const useMutationQueue = () => {
    const [queueSize, setQueueSize] = useState(mutationQueue.getQueueSize());
    const [isProcessing, setIsProcessing] = useState(mutationQueue.isProcessingQueue());

    useEffect(() => {
        const unsubscribe = mutationQueue.subscribe(() => {
            setQueueSize(mutationQueue.getQueueSize());
            setIsProcessing(mutationQueue.isProcessingQueue());
        });

        return unsubscribe;
    }, []);

    return {
        queueSize,
        isProcessing,
        hasQueuedMutations: queueSize > 0,
    };
};

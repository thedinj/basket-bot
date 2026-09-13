import { useCallback, useEffect, useState } from "react";
import { serverReachability } from "../lib/serverReachability";

/**
 * Hook to access backend reachability state.
 *
 * Distinct from `useNetworkStatus`, which reports the *device's* connection: a phone on
 * Wi-Fi with a dead server is "online" there and unreachable here.
 */
export const useServerReachability = () => {
    const [isUnreachable, setIsUnreachable] = useState(serverReachability.isUnreachable());
    const [nextProbeAt, setNextProbeAt] = useState(serverReachability.getNextProbeAt());

    useEffect(() => {
        const unsubscribe = serverReachability.subscribe(() => {
            setIsUnreachable(serverReachability.isUnreachable());
            setNextProbeAt(serverReachability.getNextProbeAt());
        });

        return unsubscribe;
    }, []);

    const probeNow = useCallback(() => serverReachability.probeNow(), []);

    return {
        isUnreachable,
        /** Epoch ms of the next automatic probe, or null when none is pending. */
        nextProbeAt,
        probeNow,
    };
};

/**
 * Whole seconds until `nextProbeAt`, re-rendering once a second so the wait is visibly
 * counting down rather than looking frozen. Null when nothing is scheduled.
 */
export const useRetryCountdown = (nextProbeAt: number | null): number | null => {
    const secondsUntil = (at: number | null) =>
        at === null ? null : Math.max(0, Math.ceil((at - Date.now()) / 1000));

    const [seconds, setSeconds] = useState(() => secondsUntil(nextProbeAt));

    useEffect(() => {
        setSeconds(secondsUntil(nextProbeAt));

        if (nextProbeAt === null) {
            return;
        }

        const interval = setInterval(() => setSeconds(secondsUntil(nextProbeAt)), 1000);
        return () => clearInterval(interval);
    }, [nextProbeAt]);

    return seconds;
};

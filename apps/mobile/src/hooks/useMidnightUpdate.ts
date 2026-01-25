import { useEffect, useState } from "react";

/**
 * Hook that triggers a state update at midnight every day.
 * Useful for recalculating date-dependent logic when the date changes.
 *
 * @returns currentDate - A string representation of the current date that updates at midnight
 */
export const useMidnightUpdate = (): string => {
    const [currentDate, setCurrentDate] = useState(() => new Date().toDateString());

    useEffect(() => {
        const scheduleNextUpdate = () => {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            const msUntilMidnight = tomorrow.getTime() - now.getTime();

            const timeout = setTimeout(() => {
                setCurrentDate(new Date().toDateString());
                scheduleNextUpdate();
            }, msUntilMidnight);

            return timeout;
        };

        const timeout = scheduleNextUpdate();
        return () => clearTimeout(timeout);
    }, []);

    return currentDate;
};

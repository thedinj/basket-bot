import clsx from "clsx";
import { ReactNode } from "react";

type RobotLineProps = {
    children: ReactNode;
    /** Blinking cursor after the text. On by default; turn it off for text that updates live. */
    cursor?: boolean;
    className?: string;
    role?: string;
    "aria-live"?: "polite" | "assertive" | "off";
};

/**
 * The robot's aside: a terminal line in the field frame with a lilac `>` prompt and a blinking
 * cursor (theme/patterns.scss .robot-line). Carries no outer margin; the caller places it.
 */
export const RobotLine: React.FC<RobotLineProps> = ({
    children,
    cursor = true,
    className,
    ...aria
}) => (
    <p className={clsx("robot-line", cursor && "robot-line--cursor", className)} {...aria}>
        <span className="robot-line__prompt" aria-hidden="true">
            &gt;
        </span>
        {children}
    </p>
);

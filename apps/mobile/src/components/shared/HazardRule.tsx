import type React from "react";
import "./HazardRule.scss";

/**
 * Diagonal hazard striping. Purely decorative, so it is hidden from assistive tech.
 *
 * Shared by the Obliterate confirm sheet and the Strike Range test bed - it is the one piece of
 * literal iconography in either, and it does the job a coloured accent bar on every row would
 * otherwise be reached for.
 */
export const HazardRule: React.FC = () => <div className="hazard-rule" aria-hidden="true" />;

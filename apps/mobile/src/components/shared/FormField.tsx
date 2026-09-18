import clsx from "clsx";
import React, { ReactNode } from "react";

type FormFieldProps = {
    label: string;
    /** Optional control on the label's line, right-aligned (e.g. Auto-Locate). */
    action?: ReactNode;
    error?: string;
    className?: string;
    children: ReactNode;
};

/**
 * One editor field: a small display-face label above its control, an optional action on the
 * label line, and an error below. Geometry and type live in theme/forms.scss; wrap the control
 * itself in `.form-control` for the shared box.
 */
export const FormField: React.FC<FormFieldProps> = ({
    label,
    action,
    error,
    className,
    children,
}) => (
    <div className={clsx("form-field", className)}>
        <div className="form-field__header">
            <span className="form-field__label">{label}</span>
            {action}
        </div>
        {children}
        {error && (
            <p className="form-field__error" role="alert">
                {error}
            </p>
        )}
    </div>
);

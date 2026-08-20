import { useEffect, useRef, useState } from "react"
import "./ProgressLine.scss"

const CHANGE_ANIMATION_MS = 700

interface ProgressLineProps {
    /** 0-1. Fraction of active items checked off. */
    progress: number
}

export const ProgressLine: React.FC<ProgressLineProps> = ({ progress }) => {
    const clamped = Math.min(1, Math.max(0, progress))
    const isComplete = clamped >= 1
    const isZero = clamped <= 0

    const prevProgressRef = useRef(clamped)
    const [isChanging, setIsChanging] = useState(false)

    useEffect(() => {
        if (prevProgressRef.current === clamped) return
        prevProgressRef.current = clamped
        setIsChanging(true)
        const timeout = setTimeout(() => setIsChanging(false), CHANGE_ANIMATION_MS)
        return () => clearTimeout(timeout)
    }, [clamped])

    return (
        <div className="progress-line" aria-hidden="true">
            <div className="progress-line__track" />
            {!isZero && (
                <div
                    className={
                        "progress-line__fill" +
                        (isComplete ? " progress-line__fill--complete" : "") +
                        (isChanging ? " progress-line__fill--changing" : "")
                    }
                    style={
                        {
                            clipPath: `inset(0 ${(1 - clamped) * 100}% 0 0)`,
                            "--progress-line-progress": clamped,
                        } as React.CSSProperties
                    }
                />
            )}
        </div>
    )
}

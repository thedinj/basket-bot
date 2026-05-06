import { useState } from "react"

import "./ScaleFactorControl.scss"

interface ScaleFactorControlProps {
    label?: string
    factor: number
    onChange: (factor: number) => void
}

const PRESETS = [0.5, 1, 2, 3]
const PRESET_LABELS = ["½×", "1×", "2×", "3×"]

const ScaleFactorControl: React.FC<ScaleFactorControlProps> = ({ label, factor, onChange }) => {
    const [draft, setDraft] = useState<string | null>(null)

    const commit = () => {
        if (draft === null) return
        const n = parseFloat(draft)
        if (!isNaN(n) && n >= 0.01 && n <= 100) onChange(n)
        setDraft(null)
    }

    const activePreset = PRESETS.includes(factor) ? factor : null

    const controls = (
        <div className="sfc-controls">
            <div className="sfc-presets" role="group" aria-label="Scale factor presets">
                {PRESETS.map((p, i) => (
                    <button
                        key={p}
                        type="button"
                        className={`sfc-preset${factor === p ? " sfc-preset--active" : ""}`}
                        onClick={() => onChange(p)}
                        aria-pressed={factor === p}
                    >
                        {PRESET_LABELS[i]}
                    </button>
                ))}
            </div>
            <input
                className={`sfc-input${activePreset === null ? " sfc-input--custom" : ""}`}
                type="number"
                min="0.01"
                max="100"
                step="0.5"
                value={draft ?? String(factor)}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                aria-label="Custom scale factor"
            />
        </div>
    )

    if (!label) {
        return (
            <div className="sfc-root sfc-root--inline">
                <span className="sfc-static-label">Scale</span>
                {controls}
            </div>
        )
    }

    return (
        <div className={`sfc-root sfc-root--stacked${factor !== 1 ? " sfc-root--modified" : ""}`}>
            <span className="sfc-recipe-label">{label}</span>
            {controls}
        </div>
    )
}

export default ScaleFactorControl

export function boolToInt(value: boolean | null | undefined): number | null {
    return value ? 1 : null;
}

export function intToBool(value: number | null | undefined): boolean {
    return value === 1;
}

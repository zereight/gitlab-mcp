export function formatBoolean(value:string | boolean | null | undefined) : boolean | null | undefined {
    if (value == null) { return value }

    if (typeof value === 'string') { return value == 'true'}
    return value
}

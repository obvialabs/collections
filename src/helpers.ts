import type { CollectionPath, CollectionPathValue } from "./types.js"

/** @internal Resolves a dot-notation value from an object. */
export function getPathValue<
    TValue,
    TPath extends CollectionPath<TValue>,
>(
    value: TValue,
    path: TPath,
): CollectionPathValue<TValue, TPath> {
    let current: unknown = value

    for (const segment of String(path).split(".")) {
        if (current === null || current === undefined) {
            return undefined as CollectionPathValue<TValue, TPath>
        }

        current = (current as Record<string, unknown>)[segment]
    }

    return current as CollectionPathValue<TValue, TPath>
}

/** @internal Compares common JavaScript scalar values in deterministic order. */
export function compareValues(left: unknown, right: unknown): number {
    if (Object.is(left, right)) return 0

    // Keep nullish values deterministic and reversible. `null` sorts before
    // `undefined`, and both sort before non-nullish values.
    const leftNullishRank = left === null ? 0 : left === undefined ? 1 : 2
    const rightNullishRank = right === null ? 0 : right === undefined ? 1 : 2

    if (leftNullishRank !== rightNullishRank) {
        return leftNullishRank - rightNullishRank
    }

    if (typeof left === "number" && typeof right === "number") {
        // `Array#sort` treats a NaN comparator result like zero, which would
        // make ordering depend on input position. Put NaN after real numbers
        // so ascending and descending orders remain deterministic.
        const leftNaN = Number.isNaN(left)
        const rightNaN = Number.isNaN(right)

        if (leftNaN || rightNaN) {
            // Equal NaN values already returned through Object.is() above, so
            // exactly one side is NaN at this point.
            return leftNaN ? 1 : -1
        }

        return left - right
    }

    if (typeof left === "bigint" && typeof right === "bigint") {
        return left < right ? -1 : 1
    }

    if (left instanceof Date && right instanceof Date) {
        return compareValues(left.getTime(), right.getTime())
    }

    return String(left).localeCompare(String(right))
}

/** @internal Validates that a collection argument is an integer. */
export function assertInteger(value: number, label: string): void {
    if (!Number.isInteger(value)) {
        throw new RangeError(`${label} must be an integer.`)
    }
}

/** @internal Validates that a collection argument is a non-negative integer. */
export function assertNonNegativeInteger(value: number, label: string): void {
    if (!Number.isInteger(value) || value < 0) {
        throw new RangeError(`${label} must be a non-negative integer.`)
    }
}

/** @internal Validates collection size and step arguments. */
export function assertPositiveInteger(value: number, label: string): void {
    if (!Number.isInteger(value) || value <= 0) {
        throw new RangeError(`${label} must be a positive integer.`)
    }
}

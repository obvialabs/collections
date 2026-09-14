import { Collection } from "./collection.js"

/** Determines whether a value is a plain object record. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== "object") return false

    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
}

/** Creates an empty collection. */
export function collect(): Collection<number, unknown>

/** Returns an existing collection without creating another instance. */
export function collect<TKey, TValue>(
    value: Collection<TKey, TValue>,
): Collection<TKey, TValue>

/** Creates a numerically keyed collection from an array. */
export function collect<const TValue>(
    value: readonly TValue[],
): Collection<number, TValue>

/** Creates a collection from a readonly map. */
export function collect<TKey, TValue>(
    value: ReadonlyMap<TKey, TValue>,
): Collection<TKey, TValue>

/** Creates a string-keyed collection from a plain object. */
export function collect<const TObject extends Record<string, unknown>>(
    value: TObject,
): Collection<keyof TObject, TObject[keyof TObject]>

/** Creates a collection from an iterable of key/value tuples. */
export function collect<TKey, TValue>(
    value: Iterable<readonly [TKey, TValue]>,
): Collection<TKey, TValue>

/**
 * Creates a collection from common JavaScript data structures.
 *
 * Arrays receive numeric keys, maps and entry iterables preserve their keys,
 * plain objects preserve their enumerable own string properties, and existing
 * collections are returned unchanged. Unsupported runtime values throw a
 * `TypeError` rather than being silently coerced into an empty collection.
 *
 * **Usage**
 * ```ts
 * collect([1, 2, 3])
 *   .filter((value) => value > 1)
 *   .map((value) => value * 2)
 *
 * collect(new Map([
 *   ["admin", user],
 * ]))
 * ```
 */
export function collect(
    value?: any,
): Collection<any, any> {
    // Return existing collection instances as-is.
    if (value instanceof Collection) {
        return value
    }

    // Create an empty collection when no source was provided.
    if (value === undefined) {
        return new Collection()
    }

    // Arrays use their current indexes as collection keys.
    if (Array.isArray(value)) {
        return new Collection(
            value.map((item, index) => [index, item] as const),
        )
    }

    // Maps already provide the exact key/value entry format we need.
    if (value instanceof Map) {
        return new Collection(value)
    }

    // Runtime primitives are not valid collection sources. In particular,
    // strings are iterable but they are not key/value entry iterables.
    if (value === null || (typeof value !== "object" && typeof value !== "function")) {
        throw new TypeError("collect() expects an array, map, entry iterable, plain object, or Collection.")
    }

    // Generic iterables are treated as key/value entry iterables.
    if (
        typeof (value as { [Symbol.iterator]?: unknown })[Symbol.iterator]
        === "function"
    ) {
        return new Collection(
            value as Iterable<readonly [unknown, unknown]>,
        )
    }

    // Plain objects preserve their enumerable own string properties.
    if (isPlainRecord(value)) {
        return new Collection(Object.entries(value))
    }

    throw new TypeError("collect() expects an array, map, entry iterable, plain object, or Collection.")
}

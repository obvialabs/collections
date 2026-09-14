import { Collection } from "./collection.js"

/** Resolves object keys to the property-key form produced by `Object.entries()`. */
type RuntimeObjectKey<TKey> = TKey extends string
    ? TKey
    : TKey extends number
        ? `${TKey}`
        : never

/** Resolves the enumerable string-keyed shape produced by `Object.entries()`. */
type ObjectCollectionShape<TObject extends Record<string, unknown>> = {
    -readonly [TKey in Extract<keyof TObject, string | number> as RuntimeObjectKey<TKey>]: TObject[TKey]
}

/** Resolves the runtime key union for an object-backed collection. */
type ObjectCollectionKey<TObject extends Record<string, unknown>> = keyof ObjectCollectionShape<TObject>

/** Resolves the runtime value union for an object-backed collection. */
type ObjectCollectionValue<TObject extends Record<string, unknown>> = ObjectCollectionShape<TObject>[ObjectCollectionKey<TObject>]

/** Determines whether a value behaves like an object record. */
function isObjectRecord(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== "object") return false

    const prototype = Object.getPrototypeOf(value)

    // Standard and null-prototype records are always valid.
    if (prototype === Object.prototype || prototype === null) {
        return true
    }

    // Objects created with `Object.create(customPrototype)` are still
    // record-like: Object.entries() should expose only their enumerable own
    // string properties. Class instances, on the other hand, own a custom
    // constructor on their immediate prototype and are structured objects
    // rather than collection records.
    return !Object.prototype.hasOwnProperty.call(prototype, "constructor")
}

/** Creates an empty collection. */
export function collect(): Collection<number, unknown>

/** Returns an existing collection without creating another instance. */
export function collect<const TCollection extends Collection<any, any, any>>(
    value: TCollection,
): TCollection

/** Creates a numerically keyed collection from an array. */
export function collect<const TValue>(
    value: readonly TValue[],
): Collection<number, TValue>

/** Creates a collection from a readonly map. */
export function collect<TKey, TValue>(
    value: ReadonlyMap<TKey, TValue>,
): Collection<TKey, TValue>

/**
 * Creates a keyed collection from an object record.
 *
 * Literal object keys remain available to `get()` and `toObject()` with their
 * key-specific value types. Runtime membership follows `Object.entries()`:
 * only enumerable own string properties participate, numeric keys normalize
 * to strings, and symbol properties are ignored.
 */
export function collect<const TObject extends Record<string, unknown>>(
    value: TObject,
): Collection<
    ObjectCollectionKey<TObject>,
    ObjectCollectionValue<TObject>,
    ObjectCollectionShape<TObject>
>

/** Creates a collection from an iterable of key/value tuples. */
export function collect<TKey, TValue>(
    value: Iterable<readonly [TKey, TValue]>,
): Collection<TKey, TValue>

/**
 * Creates a collection from common JavaScript data structures.
 *
 * Arrays receive numeric keys, maps and entry iterables preserve their keys,
 * object records preserve their enumerable own string properties, and existing
 * collections are returned unchanged. `collect()` never injects fields or
 * exposes source keys as properties on the collection instance; use `get()`
 * while working with the collection and `toObject()` when object-style access
 * is wanted at a boundary.
 *
 * Unsupported runtime values throw a `TypeError` rather than being silently
 * coerced into an empty collection.
 *
 * **Usage**
 * ```ts
 * const providers = collect({
 *   google: { label: "Google" },
 *   github: { label: "GitHub" },
 * })
 *
 * providers.get("google")?.label
 * providers.toObject().github.label
 *
 * collect([1, 2, 3])
 *   .filter((value) => value > 1)
 *   .map((value) => value * 2)
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
        throw new TypeError("collect() expects an array, map, entry iterable, object record, or Collection.")
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

    // Object records preserve their enumerable own string properties.
    if (isObjectRecord(value)) {
        return new Collection(Object.entries(value))
    }

    throw new TypeError("collect() expects an array, map, entry iterable, object record, or Collection.")
}

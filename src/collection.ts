import {
    CollectionItemNotFoundError,
    CollectionMultipleItemsError,
} from "./errors.js"
import {
    assertInteger,
    assertNonNegativeInteger,
    assertPositiveInteger,
    compareValues,
    getPathValue,
} from "./helpers.js"
import type {
    CollectionPath,
    CollectionPathValue,
    FlattenValue,
} from "./types.js"

/**
 * Immutable, fluent, strongly typed collection.
 *
 * Keys are preserved across transformations whenever the operation does not
 * explicitly change them. Every mutating-style operation returns a new
 * collection instance and never changes the source collection.
 *
 * **Usage**
 * ```ts
 * const enabled = users
 *   .filter((user) => user.enabled)
 *   .sortBy("name")
 *   .take(10)
 *
 * enabled.each((user) => console.log(user.name))
 * ```
 */
export class Collection<TKey, TValue>
implements Iterable<[TKey, TValue]> {
    /** Internal immutable collection storage. */
    readonly #store: ReadonlyMap<TKey, TValue>

    /**
     * Creates a collection from key/value entries.
     *
     * **Parameters**
     * - `entries` – Iterable containing collection key/value tuples
     */
    public constructor(entries: Iterable<readonly [TKey, TValue]> = []) {
        // Copy the source entries so later changes to the input cannot mutate
        // the collection instance.
        this.#store = new Map(entries)
    }

    /** Returns the total number of items contained by the collection. */
    public count(): number {
        return this.#store.size
    }

    /** Determines whether the collection contains no items. */
    public empty(): boolean {
        return this.count() === 0
    }

    /** Determines whether the collection contains one or more items. */
    public notEmpty(): boolean {
        return !this.empty()
    }

    /** Returns all collection values in their current order. */
    public items(): readonly TValue[] {
        return [...this.#store.values()]
    }

    /** Returns all collection values in their current order. */
    public all(): readonly TValue[] {
        return this.items()
    }

    /** Returns all collection keys in their current order. */
    public keys(): readonly TKey[] {
        return [...this.#store.keys()]
    }

    /** Returns all collection entries in their current order. */
    public entries(): readonly (readonly [TKey, TValue])[] {
        return [...this.#store.entries()]
    }

    /** Returns a defensive `Map` copy of the collection. */
    public toMap(): ReadonlyMap<TKey, TValue> {
        return new Map(this.#store)
    }

    /** Returns a native array containing the collection values. */
    public toArray(): TValue[] {
        return [...this.#store.values()]
    }

    /**
     * Converts the collection into a plain object.
     *
     * Keys must be valid JavaScript property keys at runtime.
     */
    public toObject(): Record<PropertyKey, TValue> {
        const object = Object.create(null) as Record<PropertyKey, TValue>

        for (const [key, value] of this.#store) {
            if (
                typeof key !== "string"
                && typeof key !== "number"
                && typeof key !== "symbol"
            ) {
                throw new TypeError("Collection key cannot be converted to an object property key.")
            }

            // JavaScript coerces numeric object keys to strings. Detect that
            // normalization explicitly so collections containing both `1`
            // and `"1"` cannot silently lose one value during conversion.
            const propertyKey = typeof key === "number" ? String(key) : key

            if (Object.prototype.hasOwnProperty.call(object, propertyKey)) {
                throw new TypeError("Collection keys collide after object property-key normalization.")
            }

            object[propertyKey] = value
        }

        return object
    }

    /** Returns the value associated with a collection key. */
    public get(key: TKey): TValue | undefined {
        return this.#store.get(key)
    }

    /**
     * Returns the value associated with a key or resolves a fallback value.
     */
    public getOr(
        key: TKey,
        fallback: TValue | ((key: TKey) => TValue),
    ): TValue {
        if (this.#store.has(key)) {
            return this.#store.get(key) as TValue
        }

        return typeof fallback === "function"
            ? (fallback as (key: TKey) => TValue)(key)
            : fallback
    }

    /** Determines whether a collection key exists. */
    public has(key: TKey): boolean {
        return this.#store.has(key)
    }

    /** Returns the key for the first matching value or predicate. */
    public search(value: TValue): TKey | undefined

    /** Returns the key for the first value matching a predicate. */
    public search(
        predicate: (value: TValue, key: TKey) => boolean,
    ): TKey | undefined

    public search(
        valueOrPredicate: TValue | ((value: TValue, key: TKey) => boolean),
    ): TKey | undefined {
        for (const [key, value] of this.#store) {
            const matches = typeof valueOrPredicate === "function"
                ? (valueOrPredicate as (value: TValue, key: TKey) => boolean)(value, key)
                : Object.is(value, valueOrPredicate)

            if (matches) return key
        }

        return undefined
    }

    /** Determines whether any of the provided collection keys exist. */
    public hasAny(keys: Iterable<TKey>): boolean {
        for (const key of keys) {
            if (this.has(key)) return true
        }

        return false
    }

    /** Determines whether all provided collection keys exist. */
    public hasAll(keys: Iterable<TKey>): boolean {
        for (const key of keys) {
            if (!this.has(key)) return false
        }

        return true
    }

    /** Returns the first collection value. */
    public first(): TValue | undefined

    /** Returns the first value matching a type guard predicate. */
    public first<TNarrowed extends TValue>(
        predicate: (value: TValue, key: TKey) => value is TNarrowed,
    ): TNarrowed | undefined

    /** Returns the first value matching a predicate. */
    public first(
        predicate: (value: TValue, key: TKey) => boolean,
    ): TValue | undefined

    public first(
        predicate?: (value: TValue, key: TKey) => boolean,
    ): TValue | undefined {
        for (const [key, value] of this.#store) {
            if (!predicate || predicate(value, key)) {
                return value
            }
        }

        return undefined
    }

    /** Returns the first matching value or throws when none exists. */
    public firstOrFail(
        predicate?: (value: TValue, key: TKey) => boolean,
    ): TValue {
        for (const [key, value] of this.#store) {
            if (!predicate || predicate(value, key)) {
                return value
            }
        }

        throw new CollectionItemNotFoundError()
    }

    /** Returns the last collection value. */
    public last(): TValue | undefined

    /** Returns the last value matching a predicate. */
    public last(
        predicate: (value: TValue, key: TKey) => boolean,
    ): TValue | undefined

    public last(
        predicate?: (value: TValue, key: TKey) => boolean,
    ): TValue | undefined {
        let result: TValue | undefined

        for (const [key, value] of this.#store) {
            if (!predicate || predicate(value, key)) {
                result = value
            }
        }

        return result
    }

    /** Returns the last matching value or throws when none exists. */
    public lastOrFail(
        predicate?: (value: TValue, key: TKey) => boolean,
    ): TValue {
        let result: TValue | undefined
        let found = false

        for (const [key, value] of this.#store) {
            if (!predicate || predicate(value, key)) {
                result = value
                found = true
            }
        }

        if (!found) {
            throw new CollectionItemNotFoundError()
        }

        return result as TValue
    }

    /**
     * Returns the only matching collection item.
     *
     * Throws when no item or more than one item matches.
     */
    public sole(
        predicate?: (value: TValue, key: TKey) => boolean,
    ): TValue {
        let match: TValue | undefined
        let matches = 0

        for (const [key, value] of this.#store) {
            if (!predicate || predicate(value, key)) {
                match = value
                matches += 1

                if (matches > 1) {
                    throw new CollectionMultipleItemsError()
                }
            }
        }

        if (matches === 0) {
            throw new CollectionItemNotFoundError()
        }

        return match as TValue
    }

    /** Returns every nth item while preserving the original keys. */
    public nth(step: number, offset: number = 0): Collection<TKey, TValue> {
        assertPositiveInteger(step, "Collection nth step")
        assertNonNegativeInteger(offset, "Collection nth offset")

        const entries: Array<readonly [TKey, TValue]> = []
        let index = 0

        for (const entry of this.#store) {
            if (index >= offset && (index - offset) % step === 0) {
                entries.push(entry)
            }

            index += 1
        }

        return new Collection(entries)
    }

    /** Maps every item and flattens one iterable layer into numeric keys. */
    public flatMap<TMapped>(
        callback: (value: TValue, key: TKey, collection: this) => Iterable<TMapped>,
    ): Collection<number, TMapped> {
        const values: TMapped[] = []

        for (const [key, value] of this.#store) {
            // Iterate rather than spreading callback output into `push()`.
            // Large iterables can exceed JavaScript's function-argument limit
            // even though the collection itself can represent them safely.
            for (const mapped of callback(value, key, this)) {
                values.push(mapped)
            }
        }

        return new Collection(values.map((value, index) => [index, value] as const))
    }

    /** Flattens iterable collection values by the requested depth. */
    public flatten(depth: number = Number.POSITIVE_INFINITY): Collection<number, unknown> {
        if (
            depth !== Number.POSITIVE_INFINITY
            && (!Number.isInteger(depth) || depth < 0)
        ) {
            throw new RangeError("Collection flatten depth must be a non-negative integer or Infinity.")
        }

        const output: unknown[] = []
        const stack: Array<{ value: unknown; level: number }> = [...this.#store.values()]
            .reverse()
            .map((value) => ({ value, level: depth }))

        while (stack.length > 0) {
            const current = stack.pop()!
            const iterable = current.value !== null
                && typeof current.value !== "string"
                && typeof (current.value as { [Symbol.iterator]?: unknown })[Symbol.iterator] === "function"

            if (current.level > 0 && iterable) {
                const nested = [...current.value as Iterable<unknown>]
                const nextLevel = current.level === Number.POSITIVE_INFINITY
                    ? Number.POSITIVE_INFINITY
                    : current.level - 1

                // Push in reverse so the explicit stack preserves the same
                // left-to-right traversal order as recursive flattening.
                for (let index = nested.length - 1; index >= 0; index -= 1) {
                    stack.push({ value: nested[index], level: nextLevel })
                }

                continue
            }

            output.push(current.value)
        }

        return new Collection(output.map((value, index) => [index, value] as const))
    }

    /** Collapses one iterable layer from collection values. */
    public collapse(): Collection<number, FlattenValue<TValue>> {
        return this.flatten(1) as Collection<number, FlattenValue<TValue>>
    }

    /** Maps every value while preserving the original collection keys. */
    public map<TMapped>(
        callback: (value: TValue, key: TKey, collection: this) => TMapped,
    ): Collection<TKey, TMapped> {
        const entries: Array<readonly [TKey, TMapped]> = []

        for (const [key, value] of this.#store) {
            entries.push([key, callback(value, key, this)])
        }

        return new Collection(entries)
    }

    /** Maps every value while preserving the original collection keys. */
    public mapValues<TMapped>(
        callback: (value: TValue, key: TKey, collection: this) => TMapped,
    ): Collection<TKey, TMapped> {
        return this.map(callback)
    }

    /** Maps every key while preserving its corresponding value. */
    public mapKeys<TMappedKey>(
        callback: (value: TValue, key: TKey, collection: this) => TMappedKey,
    ): Collection<TMappedKey, TValue> {
        const entries: Array<readonly [TMappedKey, TValue]> = []

        for (const [key, value] of this.#store) {
            entries.push([callback(value, key, this), value])
        }

        return new Collection(entries)
    }

    /** Maps every entry into a new key/value tuple. */
    public mapWithKeys<TMappedKey, TMappedValue>(
        callback: (
            value: TValue,
            key: TKey,
            collection: this,
        ) => readonly [TMappedKey, TMappedValue],
    ): Collection<TMappedKey, TMappedValue> {
        const entries: Array<readonly [TMappedKey, TMappedValue]> = []

        for (const [key, value] of this.#store) {
            entries.push(callback(value, key, this))
        }

        return new Collection(entries)
    }

    /** Filters collection values using a type guard predicate. */
    public filter<TNarrowed extends TValue>(
        predicate: (
            value: TValue,
            key: TKey,
            collection: this,
        ) => value is TNarrowed,
    ): Collection<TKey, TNarrowed>

    /** Filters collection values using a predicate. */
    public filter(
        predicate: (
            value: TValue,
            key: TKey,
            collection: this,
        ) => boolean,
    ): Collection<TKey, TValue>

    public filter(
        predicate: (
            value: TValue,
            key: TKey,
            collection: this,
        ) => boolean,
    ): Collection<TKey, TValue> {
        const entries: Array<readonly [TKey, TValue]> = []

        for (const [key, value] of this.#store) {
            if (predicate(value, key, this)) {
                entries.push([key, value])
            }
        }

        return new Collection(entries)
    }

    /** Rejects every value for which the predicate returns true. */
    public reject(
        predicate: (
            value: TValue,
            key: TKey,
            collection: this,
        ) => boolean,
    ): Collection<TKey, TValue> {
        return this.filter((value, key) => !predicate(value, key, this))
    }

    /** Extracts a nested value from every collection item. */
    public pluck<TPath extends CollectionPath<TValue>>(
        path: TPath,
    ): Collection<TKey, CollectionPathValue<TValue, TPath>> {
        return this.map((value) => getPathValue(value, path))
    }

    /** Re-keys the collection using a nested value path. */
    public keyBy<TPath extends CollectionPath<TValue>>(
        path: TPath,
    ): Collection<CollectionPathValue<TValue, TPath>, TValue>

    /** Re-keys the collection using a callback. */
    public keyBy<TMappedKey>(
        callback: (value: TValue, key: TKey) => TMappedKey,
    ): Collection<TMappedKey, TValue>

    public keyBy<TMappedKey>(
        selector: CollectionPath<TValue> | ((value: TValue, key: TKey) => TMappedKey),
    ): Collection<TMappedKey, TValue> {
        const entries: Array<readonly [TMappedKey, TValue]> = []

        for (const [key, value] of this.#store) {
            const mappedKey = typeof selector === "function"
                ? selector(value, key)
                : getPathValue(value, selector) as TMappedKey

            entries.push([mappedKey, value])
        }

        return new Collection(entries)
    }

    /** Filters items whose nested value strictly equals the expected value. */
    public where<TPath extends CollectionPath<TValue>>(
        path: TPath,
        expected: CollectionPathValue<TValue, TPath>,
    ): Collection<TKey, TValue> {
        return this.filter((value) => Object.is(getPathValue(value, path), expected))
    }

    /** Filters items whose nested value does not strictly equal the expected value. */
    public whereNot<TPath extends CollectionPath<TValue>>(
        path: TPath,
        expected: CollectionPathValue<TValue, TPath>,
    ): Collection<TKey, TValue> {
        return this.filter((value) => !Object.is(getPathValue(value, path), expected))
    }

    /** Filters items whose nested value is included in a provided iterable. */
    public whereIn<TPath extends CollectionPath<TValue>>(
        path: TPath,
        values: Iterable<CollectionPathValue<TValue, TPath>>,
    ): Collection<TKey, TValue> {
        const accepted = new Set(values)
        return this.filter((value) => accepted.has(getPathValue(value, path)))
    }

    /** Filters items whose nested value is not included in a provided iterable. */
    public whereNotIn<TPath extends CollectionPath<TValue>>(
        path: TPath,
        values: Iterable<CollectionPathValue<TValue, TPath>>,
    ): Collection<TKey, TValue> {
        const rejected = new Set(values)
        return this.filter((value) => !rejected.has(getPathValue(value, path)))
    }

    /** Filters items whose nested value is `null` or `undefined`. */
    public whereNull<TPath extends CollectionPath<TValue>>(
        path: TPath,
    ): Collection<TKey, TValue> {
        return this.filter((value) => getPathValue(value, path) == null)
    }

    /** Filters items whose nested value is neither `null` nor `undefined`. */
    public whereNotNull<TPath extends CollectionPath<TValue>>(
        path: TPath,
    ): Collection<TKey, TValue> {
        return this.filter((value) => getPathValue(value, path) != null)
    }

    /** Determines whether the collection contains a value. */
    public contains(value: TValue): boolean

    /** Determines whether any item satisfies a predicate. */
    public contains(
        predicate: (value: TValue, key: TKey) => boolean,
    ): boolean

    public contains(
        valueOrPredicate: TValue | ((value: TValue, key: TKey) => boolean),
    ): boolean {
        if (typeof valueOrPredicate === "function") {
            return this.some(valueOrPredicate as (value: TValue, key: TKey) => boolean)
        }

        for (const value of this.#store.values()) {
            if (Object.is(value, valueOrPredicate)) {
                return true
            }
        }

        return false
    }

    /** Determines whether the collection does not contain a value or match. */
    public doesntContain(value: TValue): boolean
    public doesntContain(
        predicate: (value: TValue, key: TKey) => boolean,
    ): boolean
    public doesntContain(
        valueOrPredicate: TValue | ((value: TValue, key: TKey) => boolean),
    ): boolean {
        return !this.contains(valueOrPredicate as TValue)
    }

    /** Determines whether every collection item satisfies a predicate. */
    public every(
        predicate: (value: TValue, key: TKey) => boolean,
    ): boolean {
        for (const [key, value] of this.#store) {
            if (!predicate(value, key)) return false
        }

        return true
    }

    /** Determines whether at least one collection item satisfies a predicate. */
    public some(
        predicate: (value: TValue, key: TKey) => boolean,
    ): boolean {
        for (const [key, value] of this.#store) {
            if (predicate(value, key)) return true
        }

        return false
    }

    /** Takes items until a predicate matches, excluding the matching item. */
    public takeUntil(
        predicate: (value: TValue, key: TKey) => boolean,
    ): Collection<TKey, TValue> {
        const entries: Array<readonly [TKey, TValue]> = []

        for (const [key, value] of this.#store) {
            if (predicate(value, key)) break
            entries.push([key, value])
        }

        return new Collection(entries)
    }

    /** Takes items while a predicate continues to return true. */
    public takeWhile(
        predicate: (value: TValue, key: TKey) => boolean,
    ): Collection<TKey, TValue> {
        const entries: Array<readonly [TKey, TValue]> = []

        for (const [key, value] of this.#store) {
            if (!predicate(value, key)) break
            entries.push([key, value])
        }

        return new Collection(entries)
    }

    /** Skips items until a predicate matches and includes the matching item. */
    public skipUntil(
        predicate: (value: TValue, key: TKey) => boolean,
    ): Collection<TKey, TValue> {
        const entries: Array<readonly [TKey, TValue]> = []
        let accepting = false

        for (const [key, value] of this.#store) {
            if (!accepting && predicate(value, key)) accepting = true
            if (accepting) entries.push([key, value])
        }

        return new Collection(entries)
    }

    /** Skips items while a predicate returns true. */
    public skipWhile(
        predicate: (value: TValue, key: TKey) => boolean,
    ): Collection<TKey, TValue> {
        const entries: Array<readonly [TKey, TValue]> = []
        let accepting = false

        for (const [key, value] of this.#store) {
            if (!accepting && !predicate(value, key)) accepting = true
            if (accepting) entries.push([key, value])
        }

        return new Collection(entries)
    }

    /** Returns a collection containing only the requested keys. */
    public only(keys: Iterable<TKey>): Collection<TKey, TValue> {
        const accepted = new Set(keys)
        return this.filter((_, key) => accepted.has(key))
    }

    /** Returns a collection excluding the requested keys. */
    public except(keys: Iterable<TKey>): Collection<TKey, TValue> {
        const rejected = new Set(keys)
        return this.filter((_, key) => !rejected.has(key))
    }

    /** Returns the first or last number of collection items. */
    public take(limit: number): Collection<TKey, TValue> {
        assertInteger(limit, "Collection take limit")
        if (limit === 0) return new Collection()

        const entries = [...this.#store.entries()]
        return new Collection(
            limit > 0
                ? entries.slice(0, limit)
                : entries.slice(limit),
        )
    }

    /** Skips a number of items from the beginning or end of the collection. */
    public skip(count: number): Collection<TKey, TValue> {
        assertInteger(count, "Collection skip count")
        const entries = [...this.#store.entries()]

        return new Collection(
            count >= 0
                ? entries.slice(count)
                : entries.slice(0, Math.max(0, entries.length + count)),
        )
    }

    /** Returns a sliced portion of the collection while preserving keys. */
    public slice(
        offset: number,
        length?: number,
    ): Collection<TKey, TValue> {
        assertInteger(offset, "Collection slice offset")
        if (length !== undefined) {
            assertNonNegativeInteger(length, "Collection slice length")
        }

        const entries = [...this.#store.entries()]
        const start = offset < 0
            ? Math.max(entries.length + offset, 0)
            : Math.min(offset, entries.length)
        const end = length === undefined ? undefined : start + length

        return new Collection(entries.slice(start, end))
    }

    /** Splits the collection into fixed-size chunks. */
    public chunk(size: number): Collection<number, Collection<TKey, TValue>> {
        assertPositiveInteger(size, "Collection chunk size")

        const entries = [...this.#store.entries()]
        const chunks: Array<readonly [number, Collection<TKey, TValue>]> = []

        for (let index = 0; index < entries.length; index += size) {
            chunks.push([
                chunks.length,
                new Collection(entries.slice(index, index + size)),
            ])
        }

        return new Collection(chunks)
    }

    /** Creates overlapping sliding windows from the collection. */
    public sliding(
        size: number,
        step: number = 1,
    ): Collection<number, Collection<TKey, TValue>> {
        assertPositiveInteger(size, "Collection sliding size")
        assertPositiveInteger(step, "Collection sliding step")

        const entries = [...this.#store.entries()]
        const windows: Array<readonly [number, Collection<TKey, TValue>]> = []

        for (let index = 0; index + size <= entries.length; index += step) {
            windows.push([
                windows.length,
                new Collection(entries.slice(index, index + size)),
            ])
        }

        return new Collection(windows)
    }

    /** Splits the collection into approximately equal groups. */
    public split(groups: number): Collection<number, Collection<TKey, TValue>> {
        assertPositiveInteger(groups, "Collection split groups")

        if (this.empty()) return new Collection()

        const entries = [...this.#store.entries()]
        const groupCount = Math.min(groups, entries.length)
        const baseSize = Math.floor(entries.length / groupCount)
        const remainder = entries.length % groupCount
        const result: Array<readonly [number, Collection<TKey, TValue>]> = []
        let offset = 0

        for (let index = 0; index < groupCount; index += 1) {
            const size = baseSize + (index < remainder ? 1 : 0)
            result.push([
                index,
                new Collection(entries.slice(offset, offset + size)),
            ])
            offset += size
        }

        return new Collection(result)
    }

    /** Pads the collection values to the requested absolute size. */
    public pad<TPad>(
        size: number,
        value: TPad,
    ): Collection<number, TValue | TPad> {
        assertInteger(size, "Collection pad size")

        const values: Array<TValue | TPad> = [...this.#store.values()]
        const target = Math.abs(size)
        const missing = Math.max(0, target - values.length)
        const padding = Array<TPad>(missing).fill(value)
        const output = size >= 0
            ? [...values, ...padding]
            : [...padding, ...values]

        return new Collection(output.map((item, index) => [index, item] as const))
    }

    /** Partitions the collection into matching and rejected collections. */
    public partition(
        predicate: (value: TValue, key: TKey) => boolean,
    ): readonly [Collection<TKey, TValue>, Collection<TKey, TValue>] {
        const accepted: Array<readonly [TKey, TValue]> = []
        const rejected: Array<readonly [TKey, TValue]> = []

        for (const [key, value] of this.#store) {
            ;(predicate(value, key) ? accepted : rejected).push([key, value])
        }

        return [new Collection(accepted), new Collection(rejected)]
    }

    /** Reverses the collection order while preserving keys. */
    public reverse(): Collection<TKey, TValue> {
        return new Collection([...this.#store.entries()].reverse())
    }

    /** Returns one random collection value. */
    public random(): TValue | undefined

    /** Returns a numerically keyed collection containing random values. */
    public random(count: number): Collection<number, TValue>

    public random(count?: number): TValue | Collection<number, TValue> | undefined {
        if (count === undefined) {
            if (this.empty()) return undefined
            const target = Math.floor(Math.random() * this.count())
            let index = 0

            for (const value of this.#store.values()) {
                if (index === target) return value
                index += 1
            }

            return undefined
        }

        assertNonNegativeInteger(count, "Collection random count")

        if (count > this.count()) {
            throw new RangeError("Collection random count cannot exceed the collection size.")
        }

        // A zero-sized sample is known without touching the RNG or shuffling
        // an otherwise potentially large collection.
        if (count === 0) {
            return new Collection()
        }

        return this.shuffle().take(count).values()
    }

    /** Randomizes the collection order while preserving keys. */
    public shuffle(): Collection<TKey, TValue> {
        const entries = [...this.#store.entries()]

        for (let index = entries.length - 1; index > 0; index -= 1) {
            const target = Math.floor(Math.random() * (index + 1))
            ;[entries[index], entries[target]] = [entries[target]!, entries[index]!]
        }

        return new Collection(entries)
    }

    /** Sorts collection items with a custom value comparator. */
    public sort(
        comparator: (
            left: TValue,
            right: TValue,
            leftKey: TKey,
            rightKey: TKey,
        ) => number,
    ): Collection<TKey, TValue> {
        const entries = [...this.#store.entries()]

        entries.sort(
            ([leftKey, left], [rightKey, right]) =>
                comparator(left, right, leftKey, rightKey),
        )

        return new Collection(entries)
    }

    /** Sorts collection items by a nested value path. */
    public sortBy<TPath extends CollectionPath<TValue>>(
        path: TPath,
    ): Collection<TKey, TValue>

    /** Sorts collection items by a callback result. */
    public sortBy<TComparable>(
        callback: (value: TValue, key: TKey) => TComparable,
    ): Collection<TKey, TValue>

    public sortBy<TComparable>(
        selector: CollectionPath<TValue> | ((value: TValue, key: TKey) => TComparable),
    ): Collection<TKey, TValue> {
        // Resolve the selector exactly once per entry. Besides avoiding
        // repeated path/callback work inside the sort comparator, this keeps
        // callback behavior deterministic for selectors with observable work.
        const selected = [...this.#store.entries()].map(([key, value]) => ({
            key,
            value,
            comparable: typeof selector === "function"
                ? selector(value, key)
                : getPathValue(value, selector),
        }))

        selected.sort((left, right) => compareValues(left.comparable, right.comparable))

        return new Collection(
            selected.map(({ key, value }) => [key, value] as const),
        )
    }

    /** Sorts collection items descending by a nested value path. */
    public sortByDesc<TPath extends CollectionPath<TValue>>(
        path: TPath,
    ): Collection<TKey, TValue>

    /** Sorts collection items descending by a callback result. */
    public sortByDesc<TComparable>(
        callback: (value: TValue, key: TKey) => TComparable,
    ): Collection<TKey, TValue>

    public sortByDesc<TComparable>(
        selector: CollectionPath<TValue> | ((value: TValue, key: TKey) => TComparable),
    ): Collection<TKey, TValue> {
        const selected = [...this.#store.entries()].map(([key, value]) => ({
            key,
            value,
            comparable: typeof selector === "function"
                ? selector(value, key)
                : getPathValue(value, selector),
        }))

        selected.sort((left, right) => compareValues(right.comparable, left.comparable))

        return new Collection(
            selected.map(({ key, value }) => [key, value] as const),
        )
    }

    /** Sorts collection items by their keys in ascending order. */
    public sortKeys(): Collection<TKey, TValue> {
        return new Collection(
            [...this.#store.entries()].sort(([left], [right]) => compareValues(left, right)),
        )
    }

    /** Sorts collection items by their keys in descending order. */
    public sortKeysDesc(): Collection<TKey, TValue> {
        return new Collection(
            [...this.#store.entries()].sort(([left], [right]) => compareValues(right, left)),
        )
    }

    /** Groups collection items by a nested value path. */
    public groupBy<TPath extends CollectionPath<TValue>>(
        path: TPath,
    ): Collection<CollectionPathValue<TValue, TPath>, Collection<TKey, TValue>>

    /** Groups collection items by a callback result. */
    public groupBy<TGroupKey>(
        callback: (value: TValue, key: TKey) => TGroupKey,
    ): Collection<TGroupKey, Collection<TKey, TValue>>

    public groupBy<TGroupKey>(
        selector: CollectionPath<TValue> | ((value: TValue, key: TKey) => TGroupKey),
    ): Collection<TGroupKey, Collection<TKey, TValue>> {
        const groups = new Map<TGroupKey, Array<readonly [TKey, TValue]>>()

        for (const [key, value] of this.#store) {
            const groupKey = typeof selector === "function"
                ? selector(value, key)
                : getPathValue(value, selector) as TGroupKey
            const group = groups.get(groupKey) ?? []

            group.push([key, value])
            groups.set(groupKey, group)
        }

        return new Collection(
            [...groups].map(([key, entries]) => [key, new Collection(entries)] as const),
        )
    }

    /** Counts items grouped by a nested value path. */
    public countBy<TPath extends CollectionPath<TValue>>(
        path: TPath,
    ): Collection<CollectionPathValue<TValue, TPath>, number>

    /** Counts items grouped by a callback result. */
    public countBy<TGroupKey>(
        callback: (value: TValue, key: TKey) => TGroupKey,
    ): Collection<TGroupKey, number>

    public countBy<TGroupKey>(
        selector: CollectionPath<TValue> | ((value: TValue, key: TKey) => TGroupKey),
    ): Collection<TGroupKey, number> {
        const counts = new Map<TGroupKey, number>()

        for (const [key, value] of this.#store) {
            const groupKey = typeof selector === "function"
                ? selector(value, key)
                : getPathValue(value, selector) as TGroupKey

            counts.set(groupKey, (counts.get(groupKey) ?? 0) + 1)
        }

        return new Collection(counts)
    }

    /** Returns only the first item for each unique callback result. */
    public unique<TUnique = TValue>(
        selector: (value: TValue, key: TKey) => TUnique = (value) => value as unknown as TUnique,
    ): Collection<TKey, TValue> {
        const seen = new Set<TUnique>()

        return this.filter((value, key) => {
            const uniqueValue = selector(value, key)

            if (seen.has(uniqueValue)) return false

            seen.add(uniqueValue)
            return true
        })
    }

    /** Returns items whose callback result has already appeared. */
    public duplicates<TUnique = TValue>(
        selector: (value: TValue, key: TKey) => TUnique = (value) => value as unknown as TUnique,
    ): Collection<TKey, TValue> {
        const seen = new Set<TUnique>()

        return this.filter((value, key) => {
            const uniqueValue = selector(value, key)
            const duplicate = seen.has(uniqueValue)
            seen.add(uniqueValue)
            return duplicate
        })
    }

    /** Returns entries whose keys are not contained by another key iterable. */
    public diffKeys(keys: Iterable<TKey>): Collection<TKey, TValue> {
        const other = new Set(keys)
        return this.filter((_, key) => !other.has(key))
    }

    /** Returns entries whose keys are contained by another key iterable. */
    public intersectByKeys(keys: Iterable<TKey>): Collection<TKey, TValue> {
        const other = new Set(keys)
        return this.filter((_, key) => other.has(key))
    }

    /** Returns values not contained by another iterable. */
    public diff(values: Iterable<TValue>): Collection<TKey, TValue> {
        const other = new Set(values)
        return this.filter((value) => !other.has(value))
    }

    /** Returns values also contained by another iterable. */
    public intersect(values: Iterable<TValue>): Collection<TKey, TValue> {
        const other = new Set(values)
        return this.filter((value) => other.has(value))
    }

    /** Adds entries whose keys do not already exist in the collection. */
    public union(
        entries: Iterable<readonly [TKey, TValue]>,
    ): Collection<TKey, TValue> {
        const result = new Map(this.#store)

        for (const [key, value] of entries) {
            if (!result.has(key)) {
                result.set(key, value)
            }
        }

        return new Collection(result)
    }

    /** Merges entries, replacing existing values that use the same key. */
    public merge<TMergeKey, TMergeValue>(
        entries: Iterable<readonly [TMergeKey, TMergeValue]>,
    ): Collection<TKey | TMergeKey, TValue | TMergeValue> {
        const result = new Map<TKey | TMergeKey, TValue | TMergeValue>(
            this.#store as ReadonlyMap<TKey | TMergeKey, TValue | TMergeValue>,
        )

        for (const [key, value] of entries) {
            result.set(key, value)
        }

        return new Collection(result)
    }

    /** Replaces only existing entries that use matching keys. */
    public replace(entries: Iterable<readonly [TKey, TValue]>): Collection<TKey, TValue> {
        const result = new Map(this.#store)

        for (const [key, value] of entries) {
            if (result.has(key)) result.set(key, value)
        }

        return new Collection(result)
    }

    /** Returns a new collection containing the provided key/value pair. */
    public with<TNewKey, TNewValue>(
        key: TNewKey,
        value: TNewValue,
    ): Collection<TKey | TNewKey, TValue | TNewValue> {
        const result = new Map<TKey | TNewKey, TValue | TNewValue>(
            this.#store as ReadonlyMap<TKey | TNewKey, TValue | TNewValue>,
        )

        result.set(key, value)
        return new Collection(result)
    }

    /** Appends a value using the next numeric collection key. */
    public append<TAppend>(value: TAppend): Collection<TKey | number, TValue | TAppend> {
        let largestKey: number | undefined

        for (const key of this.#store.keys()) {
            if (typeof key !== "number" || !Number.isFinite(key)) continue

            if (largestKey === undefined || key > largestKey) {
                largestKey = key
            }
        }

        let nextKey = largestKey === undefined ? 0 : largestKey + 1

        // Extremely large floating-point keys can make `key + 1 === key`.
        // Non-finite numeric keys also have no meaningful successor. Fall
        // back to the first free non-negative integer rather than replacing
        // an existing entry during an append operation.
        const hasNumericKey = (key: number): boolean =>
            (this.#store as ReadonlyMap<unknown, TValue>).has(key)

        if (!Number.isFinite(nextKey) || hasNumericKey(nextKey)) {
            nextKey = 0
            while (hasNumericKey(nextKey)) nextKey += 1
        }

        return this.with(nextKey, value)
    }

    /** Prepends a value and returns a numerically re-keyed collection. */
    public prepend<TPrepend>(value: TPrepend): Collection<number, TValue | TPrepend> {
        return new Collection(
            [value, ...this.#store.values()].map((item, index) => [index, item] as const),
        )
    }

    /** Returns a new collection without the provided key. */
    public remove(key: TKey): Collection<TKey, TValue> {
        const result = new Map(this.#store)
        result.delete(key)
        return new Collection(result)
    }

    /** Zips collection values with another iterable by position. */
    public zip<TOther>(
        values: Iterable<TOther>,
    ): Collection<number, readonly [TValue | undefined, TOther | undefined]> {
        const left = [...this.#store.values()]
        const right = [...values]
        const length = Math.max(left.length, right.length)
        const entries: Array<readonly [number, readonly [TValue | undefined, TOther | undefined]]> = []

        for (let index = 0; index < length; index += 1) {
            entries.push([index, [left[index], right[index]] as const])
        }

        return new Collection(entries)
    }

    /** Produces the Cartesian product of this collection and provided iterables. */
    public crossJoin<TOther>(
        values: Iterable<TOther>,
    ): Collection<number, readonly [TValue, TOther]> {
        const entries: Array<readonly [number, readonly [TValue, TOther]]> = []
        const right = [...values]

        for (const value of this.#store.values()) {
            for (const other of right) {
                entries.push([entries.length, [value, other] as const])
            }
        }

        return new Collection(entries)
    }

    /** Reduces the collection to a single accumulated result. */
    public reduce<TResult>(
        callback: (
            carry: TResult,
            value: TValue,
            key: TKey,
        ) => TResult,
        initial: TResult,
    ): TResult {
        let carry = initial

        for (const [key, value] of this.#store) {
            carry = callback(carry, value, key)
        }

        return carry
    }

    /** Executes a callback for every item and returns the original collection. */
    public each(
        callback: (value: TValue, key: TKey, collection: this) => void | boolean,
    ): this {
        for (const [key, value] of this.#store) {
            if (callback(value, key, this) === false) break
        }

        return this
    }

    /** Executes a callback with the collection and returns the same instance. */
    public tap(callback: (collection: this) => void): this {
        callback(this)
        return this
    }

    /** Pipes the collection into a callback and returns the callback result. */
    public pipe<TResult>(callback: (collection: this) => TResult): TResult {
        return callback(this)
    }

    /** Conditionally transforms the collection. */
    public when(
        condition: boolean,
        callback: (collection: this) => Collection<TKey, TValue>,
    ): Collection<TKey, TValue> {
        return condition ? callback(this) : this
    }

    /** Conditionally transforms the collection when the condition is false. */
    public unless(
        condition: boolean,
        callback: (collection: this) => Collection<TKey, TValue>,
    ): Collection<TKey, TValue> {
        return condition ? this : callback(this)
    }

    /** Sums numeric values resolved by a callback. */
    public sum(
        selector: (value: TValue, key: TKey) => number = (value) => Number(value),
    ): number {
        return this.reduce(
            (total, value, key) => total + selector(value, key),
            0,
        )
    }

    /** Returns the arithmetic average of selected numeric values. */
    public avg(
        selector: (value: TValue, key: TKey) => number = (value) => Number(value),
    ): number | undefined {
        return this.average(selector)
    }

    /** Returns the arithmetic average of selected numeric values. */
    public average(
        selector: (value: TValue, key: TKey) => number = (value) => Number(value),
    ): number | undefined {
        return this.empty()
            ? undefined
            : this.sum(selector) / this.count()
    }

    /** Returns the minimum selected value. */
    public min<TComparable = TValue>(
        selector: (value: TValue, key: TKey) => TComparable = (value) => value as unknown as TComparable,
    ): TComparable | undefined {
        let result: TComparable | undefined
        let initialized = false

        for (const [key, value] of this.#store) {
            const current = selector(value, key)

            if (!initialized || compareValues(current, result) < 0) {
                result = current
                initialized = true
            }
        }

        return result
    }

    /** Returns the maximum selected value. */
    public max<TComparable = TValue>(
        selector: (value: TValue, key: TKey) => TComparable = (value) => value as unknown as TComparable,
    ): TComparable | undefined {
        let result: TComparable | undefined
        let initialized = false

        for (const [key, value] of this.#store) {
            const current = selector(value, key)

            if (!initialized || compareValues(current, result) > 0) {
                result = current
                initialized = true
            }
        }

        return result
    }

    /** Returns the median selected numeric value. */
    public median(
        selector: (value: TValue, key: TKey) => number = (value) => Number(value),
    ): number | undefined {
        if (this.empty()) return undefined

        const values = this.entries()
            .map(([key, value]) => selector(value, key))
            .sort(compareValues)
        const middle = Math.floor(values.length / 2)

        return values.length % 2 === 0
            ? (values[middle - 1]! + values[middle]!) / 2
            : values[middle]
    }

    /** Returns the most frequently occurring selected values. */
    public mode<TMode = TValue>(
        selector: (value: TValue, key: TKey) => TMode = (value) => value as unknown as TMode,
    ): readonly TMode[] {
        const frequencies = new Map<TMode, number>()
        let highest = 0

        for (const [key, value] of this.#store) {
            const selected = selector(value, key)
            const frequency = (frequencies.get(selected) ?? 0) + 1
            frequencies.set(selected, frequency)
            highest = Math.max(highest, frequency)
        }

        return [...frequencies]
            .filter(([, frequency]) => frequency === highest)
            .map(([value]) => value)
    }

    /** Joins collection values into a string with optional final glue. */
    public join(
        glue: string,
        finalGlue?: string,
    ): string {
        const values = this.items().map(String)

        if (values.length <= 1 || finalGlue === undefined) {
            return values.join(glue)
        }

        return `${values.slice(0, -1).join(glue)}${finalGlue}${values.at(-1)}`
    }

    /** Joins a nested value from every collection item. */
    public implode<TPath extends CollectionPath<TValue>>(
        path: TPath,
        glue: string,
    ): string {
        return this.pluck(path).items().map(String).join(glue)
    }

    /** Returns a numerically re-keyed collection containing the same values. */
    public values(): Collection<number, TValue> {
        return new Collection(
            this.items().map((value, index) => [index, value] as const),
        )
    }

    /** Returns an iterator over collection key/value entries. */
    public [Symbol.iterator](): Iterator<[TKey, TValue]> {
        return this.#store[Symbol.iterator]()
    }
}

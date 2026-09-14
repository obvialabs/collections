import {
    CollectionItemNotFoundError,
    CollectionMultipleItemsError,
} from "./errors.js"
import {
    assertInteger,
    assertNonNegativeInteger,
    assertPositiveInteger,
    compareValues,
    createPathResolver,
} from "./helpers.js"
import type {
    CollectionPath,
    CollectionPathValue,
    FlattenValue,
} from "./types.js"

/** Constructor shape used by class-oriented collection transforms. */
type CollectionConstructor<TArgs extends readonly unknown[], TInstance> =
    new (...args: TArgs) => TInstance

/** Runtime class shape used by instanceof-based narrowing. */
type CollectionClass<TInstance> = abstract new (...args: any[]) => TInstance

/** Resolves collection keys to JavaScript object property keys. */
type CollectionObjectKey<TKey> = TKey extends string | symbol
    ? TKey
    : TKey extends number
        ? `${TKey}`
        : never

/** Object shape produced by `toObject()` for a collection key/value pair. */
type CollectionObject<TKey, TValue> = {
    [TProperty in CollectionObjectKey<TKey>]: TValue
}

/**
 * Tracks maps created exclusively for a new Collection instance.
 *
 * Public constructor inputs are always defensively copied. Internal transforms
 * can hand off a freshly-created Map without copying it a second time. The
 * WeakSet marker is consumed immediately by the constructor, so externally
 * supplied Maps can never bypass the defensive-copy contract.
 */
const ownedCollectionStores = new WeakSet<object>()

function collectionFromOwnedMap<TKey, TValue>(
    store: Map<TKey, TValue>,
): Collection<TKey, TValue> {
    ownedCollectionStores.add(store)
    return new Collection(store)
}

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
export class Collection<
    TKey,
    TValue,
    TObject extends object = CollectionObject<TKey, TValue>,
> implements Iterable<[TKey, TValue]> {
    /** Internal immutable collection storage. */
    readonly #store: ReadonlyMap<TKey, TValue>

    /**
     * Creates a collection from key/value entries.
     *
     * **Parameters**
     * - `entries` – Iterable containing collection key/value tuples
     */
    public constructor(entries: Iterable<readonly [TKey, TValue]> = []) {
        // Public inputs are defensively copied so later source mutations cannot
        // affect this collection. Internal transforms may transfer ownership of
        // a fresh Map and avoid an otherwise redundant second full copy.
        if (entries instanceof Map && ownedCollectionStores.has(entries)) {
            ownedCollectionStores.delete(entries)
            this.#store = entries
            return
        }

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
        return Array.from(this.#store.values())
    }

    /** Returns all collection values in their current order. */
    public all(): readonly TValue[] {
        return this.items()
    }

    /** Returns all collection keys in their current order. */
    public keys(): readonly TKey[] {
        return Array.from(this.#store.keys())
    }

    /** Returns all collection entries in their current order. */
    public entries(): readonly (readonly [TKey, TValue])[] {
        return Array.from(this.#store.entries())
    }

    /** Returns a defensive `Map` copy of the collection. */
    public toMap(): ReadonlyMap<TKey, TValue> {
        return new Map(this.#store)
    }

    /** Returns a native array containing the collection values. */
    public toArray(): TValue[] {
        return Array.from(this.#store.values())
    }

    /**
     * Converts the collection into a plain object.
     *
     * Keys must be valid JavaScript property keys at runtime.
     */
    public toObject(): TObject {
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

        return object as TObject
    }

    /** Returns the value associated with a collection key. */
    public get<TRequestedKey extends TKey>(
        key: TRequestedKey,
    ): TRequestedKey extends keyof TObject
        ? TObject[TRequestedKey] | undefined
        : TValue | undefined {
        return this.#store.get(key) as TRequestedKey extends keyof TObject
            ? TObject[TRequestedKey] | undefined
            : TValue | undefined
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

    /** Returns the value immediately before the first matching item. */
    public before(value: TValue): TValue | undefined

    /** Returns the value immediately before the first item matching a predicate. */
    public before(
        predicate: (value: TValue, key: TKey) => boolean,
    ): TValue | undefined

    public before(
        valueOrPredicate: TValue | ((value: TValue, key: TKey) => boolean),
    ): TValue | undefined {
        let previous: TValue | undefined
        let hasPrevious = false

        for (const [key, value] of this.#store) {
            const matches = typeof valueOrPredicate === "function"
                ? (valueOrPredicate as (value: TValue, key: TKey) => boolean)(value, key)
                : Object.is(value, valueOrPredicate)

            if (matches) {
                return hasPrevious ? previous : undefined
            }

            previous = value
            hasPrevious = true
        }

        return undefined
    }

    /** Returns the value immediately after the first matching item. */
    public after(value: TValue): TValue | undefined

    /** Returns the value immediately after the first item matching a predicate. */
    public after(
        predicate: (value: TValue, key: TKey) => boolean,
    ): TValue | undefined

    public after(
        valueOrPredicate: TValue | ((value: TValue, key: TKey) => boolean),
    ): TValue | undefined {
        let returnNext = false

        for (const [key, value] of this.#store) {
            if (returnNext) return value

            const matches = typeof valueOrPredicate === "function"
                ? (valueOrPredicate as (value: TValue, key: TKey) => boolean)(value, key)
                : Object.is(value, valueOrPredicate)

            if (matches) returnNext = true
        }

        return undefined
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

    /** Determines whether at least two items exist or match a predicate. */
    public hasMany(
        predicate?: (value: TValue, key: TKey) => boolean,
    ): boolean {
        if (!predicate) return this.count() >= 2

        let matches = 0

        for (const [key, value] of this.#store) {
            if (predicate(value, key) && ++matches === 2) return true
        }

        return false
    }

    /** Determines whether exactly one item exists or matches a predicate. */
    public hasSole(
        predicate?: (value: TValue, key: TKey) => boolean,
    ): boolean {
        if (!predicate) return this.count() === 1

        let matches = 0

        for (const [key, value] of this.#store) {
            if (predicate(value, key) && ++matches > 1) return false
        }

        return matches === 1
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

    /** Collapses keyed nested collections while preserving nested keys. */
    public collapseWithKeys<TNestedKey, TNestedValue>(
        this: Collection<
            TKey,
            Collection<TNestedKey, TNestedValue>
            | ReadonlyMap<TNestedKey, TNestedValue>
            | Iterable<readonly [TNestedKey, TNestedValue]>,
            any
        >,
    ): Collection<TNestedKey, TNestedValue> {
        const result = new Map<TNestedKey, TNestedValue>()

        for (const source of this.#store.values()) {
            if (source === null || typeof (source as { [Symbol.iterator]?: unknown })[Symbol.iterator] !== "function") {
                throw new TypeError("Collection collapseWithKeys values must be keyed entry iterables.")
            }

            for (const entry of source as Iterable<readonly [TNestedKey, TNestedValue]>) {
                if (!Array.isArray(entry) || entry.length < 2) {
                    throw new TypeError("Collection collapseWithKeys values must yield key/value entries.")
                }

                result.set(entry[0], entry[1])
            }
        }

        return new Collection(result)
    }

    /** Maps every value while preserving the original collection keys. */
    public map<TMapped>(
        callback: (value: TValue, key: TKey, collection: this) => TMapped,
    ): Collection<TKey, TMapped> {
        const result = new Map<TKey, TMapped>()

        for (const [key, value] of this.#store) {
            result.set(key, callback(value, key, this))
        }

        return collectionFromOwnedMap(result)
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
        const result = new Map<TMappedKey, TValue>()

        for (const [key, value] of this.#store) {
            result.set(callback(value, key, this), value)
        }

        return collectionFromOwnedMap(result)
    }

    /** Maps every entry into a new key/value tuple. */
    public mapWithKeys<TMappedKey, TMappedValue>(
        callback: (
            value: TValue,
            key: TKey,
            collection: this,
        ) => readonly [TMappedKey, TMappedValue],
    ): Collection<TMappedKey, TMappedValue> {
        const result = new Map<TMappedKey, TMappedValue>()

        for (const [key, value] of this.#store) {
            const [mappedKey, mappedValue] = callback(value, key, this)
            result.set(mappedKey, mappedValue)
        }

        return collectionFromOwnedMap(result)
    }

    /** Maps each item into a new class instance. */
    public mapInto<TInstance>(
        constructor: CollectionConstructor<readonly [TValue, TKey], TInstance>,
    ): Collection<TKey, TInstance> {
        return this.map((value, key) => new constructor(value, key))
    }

    /** Maps tuple-like values by spreading each tuple and appending its source key. */
    public mapSpread<TChunk extends readonly unknown[], TMapped>(
        this: Collection<TKey, TChunk, any>,
        callback: (...args: [...TChunk, TKey]) => TMapped,
    ): Collection<TKey, TMapped> {
        return this.map((value, key) => callback(...value, key))
    }

    /** Maps items into key/value pairs and groups mapped values by the returned key. */
    public mapToGroups<TGroupKey, TMapped>(
        callback: (value: TValue, key: TKey) => readonly [TGroupKey, TMapped],
    ): Collection<TGroupKey, Collection<number, TMapped>> {
        const groups = new Map<TGroupKey, Map<number, TMapped>>()
        const keyIterator = this.#store.keys()

        for (const value of this.#store.values()) {
            const key = keyIterator.next().value as TKey
            const [groupKey, mapped] = callback(value, key)
            let group = groups.get(groupKey)

            if (group === undefined) {
                group = new Map<number, TMapped>()
                groups.set(groupKey, group)
            }

            group.set(group.size, mapped)
        }

        const result = new Map<TGroupKey, Collection<number, TMapped>>()

        for (const [groupKey, group] of groups) {
            result.set(groupKey, collectionFromOwnedMap(group))
        }

        return collectionFromOwnedMap(result)
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
        const result = new Map<TKey, TValue>()

        for (const [key, value] of this.#store) {
            if (predicate(value, key, this)) {
                result.set(key, value)
            }
        }

        return collectionFromOwnedMap(result)
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
        const resolve = createPathResolver<CollectionPathValue<TValue, TPath>>(path)
        return this.map((value) => resolve(value))
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
        const result = new Map<TMappedKey, TValue>()

        if (typeof selector === "function") {
            for (const [key, value] of this.#store) {
                result.set(selector(value, key), value)
            }
        } else {
            const resolve = createPathResolver<TMappedKey>(selector)

            for (const value of this.#store.values()) {
                result.set(resolve(value), value)
            }
        }

        return collectionFromOwnedMap(result)
    }

    /** Filters items whose nested value strictly equals the expected value. */
    public where<TPath extends CollectionPath<TValue>>(
        path: TPath,
        expected: CollectionPathValue<TValue, TPath>,
    ): Collection<TKey, TValue> {
        const resolve = createPathResolver<CollectionPathValue<TValue, TPath>>(path)
        return this.filter((value) => Object.is(resolve(value), expected))
    }

    /** Filters items whose nested value does not strictly equal the expected value. */
    public whereNot<TPath extends CollectionPath<TValue>>(
        path: TPath,
        expected: CollectionPathValue<TValue, TPath>,
    ): Collection<TKey, TValue> {
        const resolve = createPathResolver<CollectionPathValue<TValue, TPath>>(path)
        return this.filter((value) => !Object.is(resolve(value), expected))
    }

    /** Filters items whose nested value is included in a provided iterable. */
    public whereIn<TPath extends CollectionPath<TValue>>(
        path: TPath,
        values: Iterable<CollectionPathValue<TValue, TPath>>,
    ): Collection<TKey, TValue> {
        const accepted = new Set(values)
        const resolve = createPathResolver<CollectionPathValue<TValue, TPath>>(path)
        return this.filter((value) => accepted.has(resolve(value)))
    }

    /** Filters items whose nested value is not included in a provided iterable. */
    public whereNotIn<TPath extends CollectionPath<TValue>>(
        path: TPath,
        values: Iterable<CollectionPathValue<TValue, TPath>>,
    ): Collection<TKey, TValue> {
        const rejected = new Set(values)
        const resolve = createPathResolver<CollectionPathValue<TValue, TPath>>(path)
        return this.filter((value) => !rejected.has(resolve(value)))
    }

    /** Filters items whose nested value is `null` or `undefined`. */
    public whereNull<TPath extends CollectionPath<TValue>>(
        path: TPath,
    ): Collection<TKey, TValue> {
        const resolve = createPathResolver<CollectionPathValue<TValue, TPath>>(path)
        return this.filter((value) => resolve(value) == null)
    }

    /** Filters items whose nested value is neither `null` nor `undefined`. */
    public whereNotNull<TPath extends CollectionPath<TValue>>(
        path: TPath,
    ): Collection<TKey, TValue> {
        const resolve = createPathResolver<CollectionPathValue<TValue, TPath>>(path)
        return this.filter((value) => resolve(value) != null)
    }


    /** Returns the first item whose nested value strictly equals the expected value. */
    public firstWhere<TPath extends CollectionPath<TValue>>(
        path: TPath,
        expected: CollectionPathValue<TValue, TPath>,
    ): TValue | undefined {
        const resolve = createPathResolver<CollectionPathValue<TValue, TPath>>(path)
        return this.first((value) => Object.is(resolve(value), expected))
    }

    /** Filters items whose nested value lies inside an inclusive range. */
    public whereBetween<TPath extends CollectionPath<TValue>>(
        path: TPath,
        range: readonly [
            CollectionPathValue<TValue, TPath>,
            CollectionPathValue<TValue, TPath>,
        ],
    ): Collection<TKey, TValue> {
        const [minimum, maximum] = range
        const resolve = createPathResolver<CollectionPathValue<TValue, TPath>>(path)

        return this.filter((value) => {
            const selected = resolve(value)
            return compareValues(selected, minimum) >= 0
                && compareValues(selected, maximum) <= 0
        })
    }

    /** Filters items whose nested value lies outside an inclusive range. */
    public whereNotBetween<TPath extends CollectionPath<TValue>>(
        path: TPath,
        range: readonly [
            CollectionPathValue<TValue, TPath>,
            CollectionPathValue<TValue, TPath>,
        ],
    ): Collection<TKey, TValue> {
        const [minimum, maximum] = range
        const resolve = createPathResolver<CollectionPathValue<TValue, TPath>>(path)

        return this.filter((value) => {
            const selected = resolve(value)
            return compareValues(selected, minimum) < 0
                || compareValues(selected, maximum) > 0
        })
    }

    /** Narrows collection values to instances of one class. */
    public whereInstanceOf<TInstance extends TValue>(
        type: CollectionClass<TInstance>,
    ): Collection<TKey, TInstance>

    /** Narrows collection values to instances of any provided class. */
    public whereInstanceOf<const TClasses extends readonly CollectionClass<any>[]>(
        types: TClasses,
    ): Collection<TKey, Extract<TValue, InstanceType<TClasses[number]>>>

    public whereInstanceOf(
        type: CollectionClass<any> | readonly CollectionClass<any>[],
    ): Collection<TKey, TValue> {
        const types: readonly CollectionClass<any>[] = Array.isArray(type) ? type : [type]

        return this.filter((value) =>
            types.some((candidate) => value instanceof candidate),
        )
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

        if (limit > 0) {
            const result = new Map<TKey, TValue>()
            let remaining = limit

            for (const [key, value] of this.#store) {
                result.set(key, value)
                remaining -= 1
                if (remaining === 0) break
            }

            return collectionFromOwnedMap(result)
        }

        const entries = [...this.#store.entries()]
        return new Collection(entries.slice(limit))
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


    /** Splits the collection whenever a continuation predicate returns false. */
    public chunkWhile(
        predicate: (
            value: TValue,
            key: TKey,
            chunk: Collection<TKey, TValue>,
        ) => boolean,
    ): Collection<number, Collection<TKey, TValue>> {
        const chunks: Array<readonly [number, Collection<TKey, TValue>]> = []
        let current: Array<readonly [TKey, TValue]> = []

        for (const [key, value] of this.#store) {
            if (current.length === 0) {
                current.push([key, value])
                continue
            }

            const currentCollection = new Collection<TKey, TValue>(current)

            if (predicate(value, key, currentCollection)) {
                current.push([key, value])
                continue
            }

            chunks.push([chunks.length, currentCollection])
            current = [[key, value]]
        }

        if (current.length > 0) {
            chunks.push([chunks.length, new Collection(current)])
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


    /** Splits into groups by completely filling earlier groups first. */
    public splitIn(groups: number): Collection<number, Collection<TKey, TValue>> {
        assertPositiveInteger(groups, "Collection splitIn groups")

        if (this.empty()) return new Collection()

        return this.chunk(Math.ceil(this.count() / groups))
    }

    /** Returns the positional slice represented by a one-based page number. */
    public forPage(page: number, perPage: number): Collection<TKey, TValue> {
        assertPositiveInteger(page, "Collection page")
        assertPositiveInteger(perPage, "Collection perPage")

        return this.slice((page - 1) * perPage, perPage)
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
        // Resolve the selector exactly once per entry. Building the sortable
        // records from aligned key/value iterators avoids allocating an entry
        // tuple for every source item before sorting.
        const selected = new Array<{
            key: TKey
            value: TValue
            comparable: TComparable
        }>(this.#store.size)
        const keyIterator = this.#store.keys()
        let index = 0

        if (typeof selector === "function") {
            for (const value of this.#store.values()) {
                const key = keyIterator.next().value as TKey
                selected[index] = { key, value, comparable: selector(value, key) }
                index += 1
            }
        } else {
            const resolve = createPathResolver<TComparable>(selector)

            for (const value of this.#store.values()) {
                const key = keyIterator.next().value as TKey
                selected[index] = { key, value, comparable: resolve(value) }
                index += 1
            }
        }

        selected.sort((left, right) => compareValues(left.comparable, right.comparable))

        const result = new Map<TKey, TValue>()
        for (const { key, value } of selected) result.set(key, value)
        return collectionFromOwnedMap(result)
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
        const selected = new Array<{
            key: TKey
            value: TValue
            comparable: TComparable
        }>(this.#store.size)
        const keyIterator = this.#store.keys()
        let index = 0

        if (typeof selector === "function") {
            for (const value of this.#store.values()) {
                const key = keyIterator.next().value as TKey
                selected[index] = { key, value, comparable: selector(value, key) }
                index += 1
            }
        } else {
            const resolve = createPathResolver<TComparable>(selector)

            for (const value of this.#store.values()) {
                const key = keyIterator.next().value as TKey
                selected[index] = { key, value, comparable: resolve(value) }
                index += 1
            }
        }

        selected.sort((left, right) => compareValues(right.comparable, left.comparable))

        const result = new Map<TKey, TValue>()
        for (const { key, value } of selected) result.set(key, value)
        return collectionFromOwnedMap(result)
    }

    /** Sorts collection values in descending deterministic order. */
    public sortDesc(): Collection<TKey, TValue> {
        return new Collection(
            [...this.#store.entries()].sort(([, left], [, right]) => compareValues(right, left)),
        )
    }

    /** Sorts collection items by their keys in ascending order. */
    public sortKeys(): Collection<TKey, TValue> {
        return new Collection(
            [...this.#store.entries()].sort(([left], [right]) => compareValues(left, right)),
        )
    }

    /** Sorts collection keys using a custom comparator. */
    public sortKeysUsing(
        comparator: (left: TKey, right: TKey) => number,
    ): Collection<TKey, TValue> {
        return new Collection(
            [...this.#store.entries()].sort(([left], [right]) => comparator(left, right)),
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
        const groups = new Map<TGroupKey, Map<TKey, TValue>>()
        const keyIterator = this.#store.keys()

        if (typeof selector === "function") {
            for (const value of this.#store.values()) {
                const key = keyIterator.next().value as TKey
                const groupKey = selector(value, key)
                let group = groups.get(groupKey)

                if (group === undefined) {
                    group = new Map<TKey, TValue>()
                    groups.set(groupKey, group)
                }

                group.set(key, value)
            }
        } else {
            const resolve = createPathResolver<TGroupKey>(selector)

            for (const value of this.#store.values()) {
                const key = keyIterator.next().value as TKey
                const groupKey = resolve(value)
                let group = groups.get(groupKey)

                if (group === undefined) {
                    group = new Map<TKey, TValue>()
                    groups.set(groupKey, group)
                }

                group.set(key, value)
            }
        }

        const result = new Map<TGroupKey, Collection<TKey, TValue>>()

        for (const [groupKey, group] of groups) {
            result.set(groupKey, collectionFromOwnedMap(group))
        }

        return collectionFromOwnedMap(result)
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

        if (typeof selector === "function") {
            const keyIterator = this.#store.keys()

            for (const value of this.#store.values()) {
                const key = keyIterator.next().value as TKey
                const groupKey = selector(value, key)
                counts.set(groupKey, (counts.get(groupKey) ?? 0) + 1)
            }
        } else {
            const resolve = createPathResolver<TGroupKey>(selector)

            for (const value of this.#store.values()) {
                const groupKey = resolve(value)
                counts.set(groupKey, (counts.get(groupKey) ?? 0) + 1)
            }
        }

        return collectionFromOwnedMap(counts)
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


    /** Returns entries whose exact key/value pair is absent from another collection. */
    public diffAssoc(
        entries: Iterable<readonly [TKey, TValue]>,
    ): Collection<TKey, TValue> {
        const other = new Map(entries)

        return this.filter((value, key) =>
            !other.has(key) || !Object.is(other.get(key), value),
        )
    }

    /** Returns entries whose exact key/value pair is present in another collection. */
    public intersectAssoc(
        entries: Iterable<readonly [TKey, TValue]>,
    ): Collection<TKey, TValue> {
        const other = new Map(entries)

        return this.filter((value, key) =>
            other.has(key) && Object.is(other.get(key), value),
        )
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


    /** Uses this collection's values as keys for another iterable's values. */
    public combine<TCombined>(
        values: Iterable<TCombined>,
    ): Collection<TValue, TCombined> {
        const iterator = values[Symbol.iterator]()
        const entries: Array<readonly [TValue, TCombined]> = []

        for (const key of this.#store.values()) {
            const next = iterator.next()

            if (next.done) {
                throw new RangeError("Collection combine requires the same number of keys and values.")
            }

            entries.push([key, next.value])
        }

        if (!iterator.next().done) {
            throw new RangeError("Collection combine requires the same number of keys and values.")
        }

        return new Collection(entries)
    }

    /** Swaps collection values and keys. Duplicate values use last-write semantics. */
    public flip(): Collection<TValue, TKey> {
        return new Collection(
            [...this.#store.entries()].map(([key, value]) => [value, key] as const),
        )
    }

    /** Repeats collection values the requested number of times with numeric keys. */
    public multiply(multiplier: number): Collection<number, TValue> {
        assertNonNegativeInteger(multiplier, "Collection multiply multiplier")

        const entries: Array<readonly [number, TValue]> = []

        for (let iteration = 0; iteration < multiplier; iteration += 1) {
            for (const value of this.#store.values()) {
                entries.push([entries.length, value])
            }
        }

        return new Collection(entries)
    }

    /** Appends all source values while ignoring source keys. */
    public concat<TConcat>(
        source: Iterable<TConcat>
        | Collection<unknown, TConcat>
        | ReadonlyMap<unknown, TConcat>,
    ): Collection<TKey | number, TValue | TConcat> {
        const result = new Map<TKey | number, TValue | TConcat>(
            this.#store as ReadonlyMap<TKey | number, TValue | TConcat>,
        )
        const numericKeys = new Set<number>()
        let largestNumericKey: number | undefined

        for (const key of result.keys()) {
            if (typeof key !== "number" || !Number.isFinite(key)) continue
            numericKeys.add(key)
            if (largestNumericKey === undefined || key > largestNumericKey) {
                largestNumericKey = key
            }
        }

        let nextKey = largestNumericKey === undefined ? 0 : largestNumericKey + 1
        const values: Iterable<TConcat> = source instanceof Collection
            ? source.#store.values() as Iterable<TConcat>
            : source instanceof Map
                ? source.values()
                : source as Iterable<TConcat>

        for (const value of values) {
            if (!Number.isFinite(nextKey) || numericKeys.has(nextKey)) {
                nextKey = 0
                while (numericKeys.has(nextKey)) nextKey += 1
            }

            result.set(nextKey, value)
            numericKeys.add(nextKey)
            nextKey += 1
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


    /** Reduces the collection into multiple tuple-like accumulator values. */
    public reduceSpread<TCarry extends unknown[]>(
        callback: (...args: [...TCarry, TValue, TKey]) => TCarry | readonly [...TCarry],
        ...initial: TCarry
    ): TCarry {
        let carry = initial

        for (const [key, value] of this.#store) {
            const next = callback(...carry, value, key)

            if (!Array.isArray(next)) {
                throw new TypeError("Collection reduceSpread reducer must return an array or tuple.")
            }

            carry = [...next] as TCarry
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


    /** Executes a callback for tuple-like values by spreading the tuple and source key. */
    public eachSpread<TChunk extends readonly unknown[]>(
        this: Collection<TKey, TChunk, any>,
        callback: (...args: [...TChunk, TKey]) => void | boolean,
    ): Collection<TKey, TChunk> {
        for (const [key, value] of this.#store) {
            if (callback(...value, key) === false) break
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


    /** Constructs a class instance with this collection as its constructor argument. */
    public pipeInto<TInstance>(
        constructor: CollectionConstructor<readonly [this], TInstance>,
    ): TInstance {
        return new constructor(this)
    }

    /** Returns this collection unchanged when no pipe callbacks are provided. */
    public pipeThrough(callbacks: readonly []): this

    /** Pipes through one callback with inferred output. */
    public pipeThrough<T1>(callbacks: readonly [
        (value: this) => T1,
    ]): T1

    /** Pipes through two callbacks with inferred output. */
    public pipeThrough<T1, T2>(callbacks: readonly [
        (value: this) => T1,
        (value: T1) => T2,
    ]): T2

    /** Pipes through three callbacks with inferred output. */
    public pipeThrough<T1, T2, T3>(callbacks: readonly [
        (value: this) => T1,
        (value: T1) => T2,
        (value: T2) => T3,
    ]): T3

    /** Pipes through four callbacks with inferred output. */
    public pipeThrough<T1, T2, T3, T4>(callbacks: readonly [
        (value: this) => T1,
        (value: T1) => T2,
        (value: T2) => T3,
        (value: T3) => T4,
    ]): T4

    /** Pipes through five callbacks with inferred output. */
    public pipeThrough<T1, T2, T3, T4, T5>(callbacks: readonly [
        (value: this) => T1,
        (value: T1) => T2,
        (value: T2) => T3,
        (value: T3) => T4,
        (value: T4) => T5,
    ]): T5

    /** Pipes through an arbitrary callback list when exact tuple inference is unavailable. */
    public pipeThrough(callbacks: readonly ((value: any) => any)[]): unknown

    public pipeThrough(
        callbacks: readonly ((value: any) => any)[],
    ): unknown {
        let result: unknown = this

        for (const callback of callbacks) {
            result = callback(result)
        }

        return result
    }

    /** Conditionally transforms the collection. */
    public when(
        condition: boolean,
        callback: (collection: this) => Collection<TKey, TValue>,
    ): Collection<TKey, TValue> | this {
        return condition ? callback(this) : this
    }

    /** Conditionally transforms the collection when the condition is false. */
    public unless(
        condition: boolean,
        callback: (collection: this) => Collection<TKey, TValue>,
    ): Collection<TKey, TValue> | this {
        return condition ? this : callback(this)
    }


    /** Applies a callback only when the collection is empty. */
    public whenEmpty(
        callback: (collection: this) => Collection<TKey, TValue>,
        fallback?: (collection: this) => Collection<TKey, TValue>,
    ): Collection<TKey, TValue> | this {
        if (this.empty()) return callback(this)
        return fallback ? fallback(this) : this
    }

    /** Applies a callback only when the collection is not empty. */
    public whenNotEmpty(
        callback: (collection: this) => Collection<TKey, TValue>,
        fallback?: (collection: this) => Collection<TKey, TValue>,
    ): Collection<TKey, TValue> | this {
        if (this.notEmpty()) return callback(this)
        return fallback ? fallback(this) : this
    }

    /** Alias for applying a callback unless the collection is empty. */
    public unlessEmpty(
        callback: (collection: this) => Collection<TKey, TValue>,
        fallback?: (collection: this) => Collection<TKey, TValue>,
    ): Collection<TKey, TValue> | this {
        return this.whenNotEmpty(callback, fallback)
    }

    /** Alias for applying a callback unless the collection is not empty. */
    public unlessNotEmpty(
        callback: (collection: this) => Collection<TKey, TValue>,
        fallback?: (collection: this) => Collection<TKey, TValue>,
    ): Collection<TKey, TValue> | this {
        return this.whenEmpty(callback, fallback)
    }

    /** Sums numeric values resolved by a callback. */
    public sum(
        selector?: (value: TValue, key: TKey) => number,
    ): number {
        let total = 0

        if (selector) {
            for (const [key, value] of this.#store) {
                total += selector(value, key)
            }

            return total
        }

        for (const value of this.#store.values()) {
            total += Number(value)
        }

        return total
    }

    /** Returns the arithmetic average of selected numeric values. */
    public avg(
        selector?: (value: TValue, key: TKey) => number,
    ): number | undefined {
        return this.average(selector)
    }

    /** Returns the arithmetic average of selected numeric values. */
    public average(
        selector?: (value: TValue, key: TKey) => number,
    ): number | undefined {
        return this.empty()
            ? undefined
            : this.sum(selector) / this.count()
    }


    /** Returns the percentage of items matching a predicate. */
    public percentage(
        predicate: (value: TValue, key: TKey) => boolean,
        precision: number = 2,
    ): number | undefined {
        assertInteger(precision, "Collection percentage precision")

        const total = this.#store.size
        if (total === 0) return undefined

        let matched = 0
        const keyIterator = this.#store.keys()

        // Keys and values share Map insertion order. Walking both iterators in
        // lockstep avoids allocating an entry tuple for every visited item.
        for (const value of this.#store.values()) {
            const key = keyIterator.next().value as TKey
            if (predicate(value, key)) matched += 1
        }

        const factor = 10 ** precision
        return Math.round((matched / total * 100) * factor) / factor
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

    /** Flattens nested keyed values into dot-notation keys. */
    public dot(depth: number = Number.POSITIVE_INFINITY): Collection<string, unknown> {
        if (
            depth !== Number.POSITIVE_INFINITY
            && (!Number.isInteger(depth) || depth < 0)
        ) {
            throw new RangeError("Collection dot depth must be a non-negative integer or Infinity.")
        }

        type DotNode = {
            readonly key: PropertyKey
            readonly value: unknown
            readonly level: number
            readonly ancestors: ReadonlySet<object>
        }

        const keyedEntries = (value: unknown): readonly (readonly [PropertyKey, unknown])[] | undefined => {
            if (value instanceof Collection) return value.entries()
            if (value instanceof Map) return [...value.entries()]
            if (Array.isArray(value)) {
                return value.map((item, index) => [index, item] as const)
            }

            if (value === null || typeof value !== "object" || value instanceof Date || value instanceof RegExp) {
                return undefined
            }

            return Object.entries(value)
        }

        const output: Array<readonly [string, unknown]> = []
        const stack: DotNode[] = [...this.#store.entries()]
            .reverse()
            .map(([key, value]) => ({
                key: key as PropertyKey,
                value,
                level: 0,
                ancestors: new Set<object>(),
            }))

        while (stack.length > 0) {
            const node = stack.pop()!
            if (typeof node.key !== "string" && typeof node.key !== "number") {
                throw new TypeError("Collection dot keys must be strings or numbers.")
            }

            const path = String(node.key)
            const nested = node.level < depth ? keyedEntries(node.value) : undefined

            if (nested && nested.length > 0) {
                if (typeof node.value === "object" && node.value !== null) {
                    if (node.ancestors.has(node.value)) {
                        throw new TypeError("Collection dot cannot flatten cyclic values.")
                    }
                }

                const ancestors = new Set(node.ancestors)
                if (typeof node.value === "object" && node.value !== null) {
                    ancestors.add(node.value)
                }

                for (let index = nested.length - 1; index >= 0; index -= 1) {
                    const [nestedKey, nestedValue] = nested[index]!
                    if (typeof nestedKey !== "string" && typeof nestedKey !== "number") {
                        throw new TypeError("Collection dot keys must be strings or numbers.")
                    }

                    stack.push({
                        key: `${path}.${String(nestedKey)}`,
                        value: nestedValue,
                        level: node.level + 1,
                        ancestors,
                    })
                }

                continue
            }

            output.push([path, node.value])
        }

        return new Collection(output)
    }

    /** Expands dot-notation keys into nested object values. */
    public undot(
        this: Collection<TKey, TValue, any>,
    ): Collection<string, unknown> {
        const root = new Map<string, unknown>()

        for (const [rawKey, value] of this.#store) {
            if (typeof rawKey !== "string" && typeof rawKey !== "number") {
                throw new TypeError("Collection undot keys must be strings or numbers.")
            }

            const parts = String(rawKey).split(".")
            const top = parts.shift()!

            if (parts.length === 0) {
                root.set(top, value)
                continue
            }

            let current = root.get(top)
            if (current === null || typeof current !== "object" || Array.isArray(current)) {
                current = Object.create(null) as Record<string, unknown>
                root.set(top, current)
            }

            let object = current as Record<string, unknown>

            while (parts.length > 1) {
                const segment = parts.shift()!
                const existing = object[segment]

                if (existing === null || typeof existing !== "object" || Array.isArray(existing)) {
                    object[segment] = Object.create(null) as Record<string, unknown>
                }

                object = object[segment] as Record<string, unknown>
            }

            object[parts[0]!] = value
        }

        return new Collection(root)
    }

    /** Projects selected top-level properties from every collection value. */
    public select<TSelected extends keyof TValue>(
        key: TSelected,
    ): Collection<TKey, Pick<TValue, TSelected>>

    /** Projects selected top-level properties from every collection value. */
    public select<const TSelected extends readonly (keyof TValue)[]>(
        keys: TSelected,
    ): Collection<TKey, Pick<TValue, TSelected[number]>>

    public select(
        keys: keyof TValue | readonly (keyof TValue)[],
    ): Collection<TKey, any> {
        const selected = (Array.isArray(keys) ? keys : [keys]) as readonly PropertyKey[]
        const entries = new Array<readonly [TKey, Partial<TValue>]>(this.#store.size)
        const firstKey = selected[0]
        const secondKey = selected[1]
        let index = 0

        if (selected.length === 1 && firstKey !== undefined) {
            for (const [collectionKey, value] of this.#store) {
                const projected: Partial<TValue> = {}

                if ((typeof value === "object" || typeof value === "function") && value !== null) {
                    const source = value as Record<PropertyKey, unknown>
                    const target = projected as Record<PropertyKey, unknown>
                    if (Object.prototype.hasOwnProperty.call(source, firstKey)) {
                        target[firstKey] = source[firstKey]
                    }
                }

                entries[index] = [collectionKey, projected]
                index += 1
            }

            return new Collection(entries)
        }

        if (selected.length === 2 && firstKey !== undefined && secondKey !== undefined) {
            for (const [collectionKey, value] of this.#store) {
                const projected: Partial<TValue> = {}

                if ((typeof value === "object" || typeof value === "function") && value !== null) {
                    const source = value as Record<PropertyKey, unknown>
                    const target = projected as Record<PropertyKey, unknown>

                    if (Object.prototype.hasOwnProperty.call(source, firstKey)) {
                        target[firstKey] = source[firstKey]
                    }
                    if (Object.prototype.hasOwnProperty.call(source, secondKey)) {
                        target[secondKey] = source[secondKey]
                    }
                }

                entries[index] = [collectionKey, projected]
                index += 1
            }

            return new Collection(entries)
        }

        for (const [collectionKey, value] of this.#store) {
            const projected: Partial<TValue> = {}

            if ((typeof value === "object" || typeof value === "function") && value !== null) {
                const source = value as Record<PropertyKey, unknown>
                const target = projected as Record<PropertyKey, unknown>

                for (const key of selected) {
                    if (Object.prototype.hasOwnProperty.call(source, key)) {
                        target[key] = source[key]
                    }
                }
            }

            entries[index] = [collectionKey, projected]
            index += 1
        }

        return new Collection(entries)
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

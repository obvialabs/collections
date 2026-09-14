import { Collection } from "./collection.js"

/** Represents a generic keyed collection definition. */
export type CollectionDefinition = Record<string, object>

/** Resolves source object keys to their JavaScript runtime property form. */
type RuntimeDefinitionKey<TKey> = TKey extends string
    ? TKey
    : TKey extends number
        ? `${TKey}`
        : never

/** Resolves every supported definition key as it exists at runtime. */
export type CollectionDefinitionKey<
    TDefinition extends CollectionDefinition,
> = RuntimeDefinitionKey<Extract<keyof TDefinition, string | number>>

/** Resolves the original source key represented by a runtime definition key. */
type SourceDefinitionKey<
    TDefinition extends CollectionDefinition,
    TId extends CollectionDefinitionKey<TDefinition>,
> = {
    [TKey in Extract<keyof TDefinition, string | number>]:
        RuntimeDefinitionKey<TKey> extends TId ? TKey : never
}[Extract<keyof TDefinition, string | number>]

/**
 * Resolves a keyed definition item and automatically injects its literal ID.
 *
 * An explicitly provided `id` field is intentionally replaced by the
 * definition key so the collection remains the single source of truth.
 */
export type CollectionItem<
    TDefinition extends CollectionDefinition,
    TId extends CollectionDefinitionKey<TDefinition>,
> = Omit<TDefinition[SourceDefinitionKey<TDefinition, TId>], "id"> & {
    readonly id: TId
}

/** Resolves every keyed definition item into a strongly typed union. */
export type CollectionItems<
    TDefinition extends CollectionDefinition,
> = {
    [TId in CollectionDefinitionKey<TDefinition>]: CollectionItem<TDefinition, TId>
}[CollectionDefinitionKey<TDefinition>]

/** Legacy members inherited from `Object.prototype` but absent from `keyof Object`. */
type LegacyObjectPrototypeKey =
    | "__defineGetter__"
    | "__defineSetter__"
    | "__lookupGetter__"
    | "__lookupSetter__"
    | "__proto__"

/** Resolves keys that do not collide with the runtime collection API. */
type DirectCollectionKey<
    TDefinition extends CollectionDefinition,
> = Exclude<
    CollectionDefinitionKey<TDefinition>,
    | keyof Collection<CollectionDefinitionKey<TDefinition>, CollectionItems<TDefinition>>
    | keyof Object
    | LegacyObjectPrototypeKey
>

/**
 * Collection returned by `createCollection()`.
 *
 * Non-conflicting definition keys are exposed directly while all keys,
 * including names such as `map`, `filter` or `count`, remain accessible
 * through `get()`.
 */
export type DefinedCollection<
    TDefinition extends CollectionDefinition,
> = Omit<
    Collection<CollectionDefinitionKey<TDefinition>, CollectionItems<TDefinition>>,
    "get"
> & {
    /** Returns a definition item with its exact item type preserved. */
    get<TId extends CollectionDefinitionKey<TDefinition>>(
        key: TId,
    ): CollectionItem<TDefinition, TId> | undefined
} & {
    /** Exposes non-conflicting definition keys directly on the collection. */
    readonly [TId in DirectCollectionKey<TDefinition>]:
        CollectionItem<TDefinition, TId>
}

/** Determines whether a value is a plain object suitable for a definition root. */
function isPlainDefinition(value: unknown): value is Record<string, object> {
    if (value === null || typeof value !== "object") return false

    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
}

/**
 * Creates a strongly typed keyed collection from an object definition.
 *
 * Every definition key becomes the corresponding item's literal `id`.
 * Numeric object-literal keys follow JavaScript semantics and are normalized
 * to their runtime string form. Non-conflicting keys can also be accessed
 * directly from the returned collection instance.
 *
 * **Parameters**
 * - `definition` – Plain object containing collection items keyed by unique IDs
 *
 * **Usage**
 * ```ts
 * const slides = createCollection({
 *   canvas: {
 *     title: "Canvas",
 *   },
 *   security: {
 *     title: "Security",
 *   },
 * })
 *
 * slides.canvas.id // "canvas"
 * slides.security.title // "Security"
 * slides.get("security")
 * slides.items()
 * slides.keys()
 * slides.count()
 * ```
 */
export function createCollection<
    const TDefinition extends CollectionDefinition,
>(
    definition: TDefinition,
): DefinedCollection<TDefinition> {
    type Key = CollectionDefinitionKey<TDefinition>
    type Item = CollectionItems<TDefinition>

    if (!isPlainDefinition(definition)) {
        throw new TypeError("createCollection() expects a plain object definition.")
    }

    const ownKeys = Reflect.ownKeys(definition)

    if (ownKeys.some((key) => typeof key === "symbol")) {
        throw new TypeError("createCollection() definition keys must be strings or numeric object keys.")
    }

    // Resolve every own definition entry and force the object key to be the
    // item's canonical ID even when the original definition contains `id`.
    // Reflect.ownKeys keeps the runtime surface aligned with keyof even for
    // non-enumerable own properties.
    const entries = ownKeys.map((runtimeKey) => {
        const id = String(runtimeKey) as Key
        const item = definition[runtimeKey as keyof TDefinition]

        return [
            id,
            {
                ...item,
                id,
            } as Item,
        ] as const
    })

    // Create the immutable runtime collection used by all fluent operations.
    const collection = new Collection<Key, Item>(entries)

    // Expose safe definition keys directly without shadowing Collection
    // methods such as `map`, `filter`, `count` or inherited object members.
    for (const [key, item] of entries) {
        if (key in collection) {
            continue
        }

        Object.defineProperty(collection, key, {
            value: item,
            enumerable: true,
            writable: false,
            configurable: false,
        })
    }

    // The runtime instance now satisfies both the fluent Collection API and
    // the exact direct-access definition surface.
    return collection as DefinedCollection<TDefinition>
}

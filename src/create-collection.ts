import { Collection } from "./collection"

/** Represents a generic keyed collection definition. */
export type CollectionDefinition = Record<string, object>

/**
 * Resolves a keyed definition item and automatically injects its literal ID.
 *
 * An explicitly provided `id` field is intentionally replaced by the
 * definition key so the collection remains the single source of truth.
 */
export type CollectionItem<
    TDefinition extends CollectionDefinition,
    TId extends keyof TDefinition,
> = Omit<TDefinition[TId], "id"> & {
    readonly id: TId
}

/** Resolves every keyed definition item into a strongly typed union. */
export type CollectionItems<
    TDefinition extends CollectionDefinition,
> = {
    [TId in keyof TDefinition]: CollectionItem<TDefinition, TId>
}[keyof TDefinition]

/** Resolves keys that do not collide with the runtime collection API. */
type DirectCollectionKey<
    TDefinition extends CollectionDefinition,
> = Exclude<
    keyof TDefinition,
    | keyof Collection<keyof TDefinition, CollectionItems<TDefinition>>
    | keyof Object
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
    Collection<keyof TDefinition, CollectionItems<TDefinition>>,
    "get"
> & {
    /** Returns a definition item with its exact item type preserved. */
    get<TId extends keyof TDefinition>(
        key: TId,
    ): CollectionItem<TDefinition, TId> | undefined
} & {
    /** Exposes non-conflicting definition keys directly on the collection. */
    readonly [TId in DirectCollectionKey<TDefinition>]:
        CollectionItem<TDefinition, TId>
}

/**
 * Creates a strongly typed keyed collection from an object definition.
 *
 * Every definition key becomes the corresponding item's literal `id`.
 * Non-conflicting keys can also be accessed directly from the returned
 * collection instance.
 *
 * **Parameters**
 * - `definition` – Object containing collection items keyed by unique IDs
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
    type Key = keyof TDefinition
    type Item = CollectionItems<TDefinition>

    // Resolve every definition entry and force the object key to be the item's
    // canonical ID even when the original definition contains an `id` field.
    const entries = Object.entries(definition).map(
        ([id, item]) => [
            id as Key,
            {
                ...item,
                id,
            } as Item,
        ] as const,
    )

    // Create the immutable runtime collection used by all fluent operations.
    const collection = new Collection<Key, Item>(entries)

    // Expose safe definition keys directly without shadowing Collection
    // methods such as `map`, `filter`, `count` or inherited object members.
    for (const [key, item] of entries) {
        if (typeof key === "string" && key in collection) {
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

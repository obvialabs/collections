/** Primitive values that should not be traversed while resolving nested paths. */
export type AtomicValue =
    | bigint
    | boolean
    | Date
    | Function
    | null
    | number
    | RegExp
    | string
    | symbol
    | undefined

/** Internal recursion budget used by dot-path inference. */
type CollectionPathDepth = readonly unknown[]

/** Removes nullable branches before deciding whether a property can be traversed. */
type TraversableValue<TValue> = Exclude<TValue, null | undefined>

/**
 * Resolves valid dot-notation paths for an object value.
 *
 * Arrays and atomic values are treated as terminal values. Recursive object
 * models are supported through a bounded inference depth so self-referential
 * application types cannot make TypeScript recurse indefinitely.
 */
export type CollectionPath<TValue> = CollectionPathInternal<TValue>

type CollectionPathInternal<
    TValue,
    TDepth extends CollectionPathDepth = [],
> = TDepth["length"] extends 8
    ? never
    : TValue extends AtomicValue
        ? never
        : TValue extends readonly unknown[]
            ? never
            : {
                [TKey in Extract<keyof TValue, string>]:
                    TraversableValue<TValue[TKey]> extends AtomicValue | readonly unknown[]
                        ? TKey
                        : TKey | `${TKey}.${CollectionPathInternal<
                            TraversableValue<TValue[TKey]>,
                            readonly [...TDepth, unknown]
                        >}`
            }[Extract<keyof TValue, string>]

/** Resolves the value represented by a dot-notation collection path. */
export type CollectionPathValue<
    TValue,
    TPath extends string,
> = TValue extends null | undefined
    ? undefined
    : TPath extends `${infer THead}.${infer TTail}`
        ? THead extends keyof TValue
            ? CollectionPathValue<TValue[THead], TTail>
            : never
        : TPath extends keyof TValue
            ? TValue[TPath]
            : never

/** Resolves one iterable/array layer from a collection value. */
export type FlattenValue<TValue> = TValue extends Iterable<infer TItem>
    ? TItem
    : TValue

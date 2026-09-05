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

/**
 * Resolves valid dot-notation paths for an object value.
 *
 * Arrays and atomic values are treated as terminal values so collection
 * helpers do not infer paths through runtime objects or list internals.
 */
export type CollectionPath<TValue> = TValue extends AtomicValue
    ? never
    : TValue extends readonly unknown[]
        ? never
        : {
            [TKey in Extract<keyof TValue, string>]:
                TValue[TKey] extends AtomicValue | readonly unknown[]
                    ? TKey
                    : TKey | `${TKey}.${CollectionPath<TValue[TKey]>}`
        }[Extract<keyof TValue, string>]

/** Resolves the value represented by a dot-notation collection path. */
export type CollectionPathValue<
    TValue,
    TPath extends string,
> = TPath extends `${infer THead}.${infer TTail}`
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

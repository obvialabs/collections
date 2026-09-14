# API Reference

Complete API reference for `@obvia/collections`. This document is intentionally detailed; for installation, concepts, and common workflows, start with the [package README](../README.md).

The collection API is immutable: operations return new `Collection` instances unless a method explicitly returns a scalar, array, map, object, tuple, or another non-collection result.

> `createCollection()` adds definition IDs and root-level direct access. Fluent transformations return the regular `Collection` abstraction. See the README for the factory comparison.

## Creating Collections

### `collect`

Creates a collection from an array, readonly map, object record, iterable of entries, existing collection or no source at all.

```ts
import { collect } from "@obvia/collections"

const empty = collect()
const numbers = collect([10, 20, 30])
const roles = collect(new Map([
    ["admin", 1],
    ["member", 2],
]))
const object = collect({ active: true, queued: false })
const numericKeys = collect({ 1: "one" })

numericKeys.keys() // ["1"]
```

Arrays use numeric keys. Maps and entry iterables preserve their original keys. Object records follow `Object.entries()` semantics: enumerable own string properties are collected, inherited and non-enumerable properties are ignored, numeric object keys are normalized to strings, and symbol-only properties are excluded. Record-like objects created with `Object.create(customPrototype)` are supported; structured instances such as `Date`, `RegExp`, and class instances are rejected. Passing an existing `Collection` returns the same collection instance.

### `createCollection`

Creates a strongly typed keyed collection from an object definition. The definition key becomes the canonical literal `id` for that item.

```ts
import { createCollection } from "@obvia/collections"

const slides = createCollection({
    canvas: {
        title: "Design visually",
        stats: { nodes: 24 },
    },
    security: {
        title: "Protect workspaces",
        stats: { nodes: 12 },
    },
})

slides.canvas.id // "canvas"
slides.canvas.title // "Design visually"
slides.security.stats.nodes // 12
slides.get("security")?.id // "security"
```

An `id` supplied inside an item is replaced by the definition key so the object key remains the single source of truth.

```ts
const items = createCollection({
    primary: {
        id: "wrong",
        label: "Primary",
    },
})

items.primary.id // "primary"
```

#### Direct-access collisions

Safe definition keys are exposed directly. Keys that collide with collection methods or inherited object members remain available through `get()`.

```ts
const definitions = createCollection({
    security: { label: "Security" },
    map: { label: "Map" },
    constructor: { label: "Constructor" },
    ["__proto__"]: { label: "Prototype" },
})

definitions.security.label // "Security"
definitions.get("map")?.label // "Map"
definitions.get("constructor")?.label // "Constructor"
definitions.get("__proto__")?.label // "Prototype"

definitions.map((item) => item.label) // still the Collection method
```

### `new Collection`

Creates a collection directly from key/value tuples.

```ts
import { Collection } from "@obvia/collections"

const collection = new Collection([
    ["first", 10],
    ["second", 20],
] as const)
```

## Type-safe Nested Paths

Several methods accept dot-notation paths and infer their result from the collection value type.

```ts
const users = createCollection({
    ada: {
        profile: {
            email: "ada@example.com",
            score: 90,
        },
    },
    grace: {
        profile: {
            email: "grace@example.com",
            score: 80,
        },
    },
})

users.pluck("profile.email")
users.sortBy("profile.score")
users.keyBy("profile.email")
```

Invalid paths are rejected by TypeScript.

```ts
users.pluck("profile.missing")
//          ^ TypeScript error
```

The nested-path API is available to `pluck`, `keyBy`, `where*`, `sortBy`, `sortByDesc`, `groupBy`, `countBy` and `implode`.

Optional intermediate objects are reflected in the inferred result instead of being treated as an invalid path. If an intermediate property may be `undefined`, the resolved value may be `undefined` too.

```ts
type User = {
    profile?: {
        email: string
    }
}

const users = collect<User>([
    { profile: { email: "ada@example.com" } },
    {},
])

const emails = users.pluck("profile.email")
// Collection<number, string | undefined>

emails.items()
// ["ada@example.com", undefined]
```

This behavior is useful when a path is structurally valid for the domain type even though some records do not currently contain every optional branch. A path that does not exist in the type at all is still rejected by TypeScript.

## Collection

The following sections document the runtime methods exposed by `Collection<TKey, TValue>`.

## State & Values

### `count`

Returns the number of entries in the collection.


**Behavior:** `number`. Number of stored key/value entries.
```ts
count(): number
```

```ts
const count = collect([10, 20, 30]).count() // 3
```

### `empty`

Returns `true` when the collection contains no entries.


**Behavior:** `boolean`. `true` only when `count() === 0`.
```ts
empty(): boolean
```

```ts
collect([]).empty() // true
```

### `notEmpty`

Returns `true` when the collection contains at least one entry.


**Behavior:** `boolean`. Exact inverse of `empty()`.
```ts
notEmpty(): boolean
```

```ts
collect([1]).notEmpty() // true
```

### `items`

Returns collection values in their current order as a readonly array.


**Behavior:** readonly array. Fresh array snapshot of values in iteration order.
```ts
items(): readonly TValue[]
```

```ts
collect(new Map([["a", 1], ["b", 2]])).items() // [1, 2]
```

### `all`

Alias for `items()`.


**Behavior:** readonly array. Alias of `items()`.
```ts
all(): readonly TValue[]
```

```ts
collect([1, 2]).all() // [1, 2]
```

### `keys`

Returns collection keys in their current order.


**Behavior:** readonly array. Fresh array snapshot of keys in iteration order.
```ts
keys(): readonly TKey[]
```

```ts
collect({ active: true, queued: false }).keys() // ["active", "queued"]
```

### `entries`

Returns readonly key/value tuples in their current order.


**Behavior:** readonly tuple array. Fresh entry-container snapshot; values remain shallow references.
```ts
entries(): readonly (readonly [TKey, TValue])[]
```

```ts
collect(new Map([["a", 1]])).entries() // [["a", 1]]
```

### `values`

Returns the same values in a new collection with contiguous numeric keys.


**Behavior:** numeric keys. Same values, always reindexed `0..n-1`.
```ts
values(): Collection<number, TValue>
```

```ts
collect(new Map([["a", 10], ["b", 20]])).values().keys() // [0, 1]
```

## Conversion

### `toArray`

Returns a mutable native array copy of the collection values.


**Behavior:** mutable array. Native mutable copy of values; mutating it cannot change collection membership.
```ts
toArray(): TValue[]
```

```ts
const array = collect([1, 2, 3]).toArray()
```

### `toMap`

Returns a defensive `Map` copy of the collection.


**Behavior:** `ReadonlyMap`. Defensive `Map` copy.
```ts
toMap(): ReadonlyMap<TKey, TValue>
```

```ts
const map = collect({ a: 1, b: 2 }).toMap()
```

### `toObject`

Converts the collection into a plain null-prototype object. Runtime keys must be valid property keys.


**Behavior:** null-prototype object. Accepts only string/number/symbol runtime keys; rejects other key types instead of coercing them.
```ts
toObject(): Record<PropertyKey, TValue>
```

```ts
collect(new Map([["draft", true]])).toObject() // { draft: true }
```

## Access

### `get`

Returns the value stored at a key, or `undefined` when the key is missing.


**Behavior:** value or `undefined`. Cannot by itself distinguish missing from a present `undefined`; pair with `has()` when needed.
```ts
get(key: TKey): TValue | undefined
```

```ts
users.get("ada")

const settings = new Collection<string, string | undefined>([
    ["theme", undefined],
])

settings.get("theme") // undefined
settings.get("missing") // undefined
settings.has("theme") // true - use has() when present undefined matters
```

### `getOr`

Returns the keyed value when present; otherwise resolves a value or callback fallback. Existing `undefined` values are not treated as missing.


**Behavior:** value. Fallback runs only when the key is absent, never for a present `undefined` value.
```ts
getOr(key: TKey, fallback: TValue | ((key: TKey) => TValue)): TValue
```

```ts
const settings = new Collection<string, string | undefined>([
    ["theme", undefined],
])

settings.getOr("theme", () => "system")
// undefined - the fallback is NOT evaluated because the key exists

settings.getOr("missing", (key) => `${key}:system`)
// "missing:system"
```

### `has`

Determines whether a key exists.


**Behavior:** `boolean`. Native `Map` key identity semantics.
```ts
has(key: TKey): boolean
```

```ts
users.has("ada")
```

### `hasAny`

Returns `true` when at least one provided key exists.


**Behavior:** `boolean`. Short-circuits on first existing key; empty key iterable => `false`.
```ts
hasAny(keys: Iterable<TKey>): boolean
```

```ts
users.hasAny(["ada", "unknown"])
```

### `hasAll`

Returns `true` when every provided key exists.


**Behavior:** `boolean`. Short-circuits on first missing key; empty key iterable => `true`.
```ts
hasAll(keys: Iterable<TKey>): boolean
```

```ts
users.hasAll(["ada", "grace"])
```

### `before`

Returns the value immediately before the first strict value or predicate match.

**Behavior:** value or `undefined`. Value matching uses `Object.is`; predicate matching stops at the first match; no predecessor or no match returns `undefined`.
```ts
before(value: TValue): TValue | undefined
before(predicate: (value: TValue, key: TKey) => boolean): TValue | undefined
```

```ts
collect([10, 20, 30]).before(20) // 10
collect([10, 20, 30]).before((value) => value > 20) // 20
```

### `after`

Returns the value immediately after the first strict value or predicate match.

**Behavior:** value or `undefined`. Value matching uses `Object.is`; the predicate is not evaluated after the first match; no successor or no match returns `undefined`.
```ts
after(value: TValue): TValue | undefined
after(predicate: (value: TValue, key: TKey) => boolean): TValue | undefined
```

```ts
collect([10, 20, 30]).after(20) // 30
collect([10, 20, 30]).after((value) => value >= 20) // 30
```

### `hasMany`

Checks whether at least two items exist, optionally after applying a predicate.

**Behavior:** boolean. Without a predicate this is a cardinality check; with a predicate iteration short-circuits on the second match.
```ts
hasMany(predicate?: (value: TValue, key: TKey) => boolean): boolean
```

```ts
collect([1, 2]).hasMany() // true
collect([1, 2, 3, 4]).hasMany((value) => value % 2 === 0) // true
```

### `hasSole`

Checks whether exactly one item exists, optionally after applying a predicate.

**Behavior:** boolean. Predicate evaluation stops as soon as a second match proves that the result cannot be sole.
```ts
hasSole(predicate?: (value: TValue, key: TKey) => boolean): boolean
```

```ts
collect([1]).hasSole() // true
collect([1, 2, 3]).hasSole((value) => value > 2) // true
```

### `search`

Returns the key of the first value equal to the supplied value, or the first value matching a predicate.


**Behavior:** key or `undefined`. First `Object.is` value match; first predicate match; short-circuits.
```ts
search(valueOrPredicate): TKey | undefined
```

```ts
collect(new Map([["a", 10], ["b", 20]])).search(20) // "b"
```

### `first`

Returns the first value, or the first value matching an optional predicate.


**Behavior:** value or `undefined`. First entry, or first match.
```ts
first(predicate?): TValue | undefined
```

```ts
collect([10, 20, 30]).first((value) => value > 10) // 20
```

### `firstWhere`

Returns the first item whose typed nested path strictly equals an expected value.

**Behavior:** value or `undefined`. Equality uses `Object.is` and the scan short-circuits at the first match.
```ts
firstWhere(path, expected): TValue | undefined
```

```ts
users.firstWhere("profile.status", "active")
collect([{ score: Number.NaN }]).firstWhere("score", Number.NaN)
```

### `firstOrFail`

Returns the first matching value and throws `CollectionItemNotFoundError` if no value matches.


**Behavior:** value. Same selection as `first`; throws `CollectionItemNotFoundError` when absent.
```ts
firstOrFail(predicate?): TValue
```

```ts
users.firstOrFail((user) => user.enabled)
```

### `last`

Returns the last value, or the last value matching an optional predicate.


**Behavior:** value or `undefined`. Last matching entry; predicate necessarily scans the whole collection.
```ts
last(predicate?): TValue | undefined
```

```ts
collect([10, 20, 30]).last() // 30
```

### `lastOrFail`

Returns the last matching value and throws when no value matches.


**Behavior:** value. Throws when no match exists.
```ts
lastOrFail(predicate?): TValue
```

```ts
users.lastOrFail((user) => user.enabled)
```

### `sole`

Returns the only matching value. Throws when zero or multiple values match.


**Behavior:** value. Requires exactly one match; throws on zero or the moment a second match is found.
```ts
sole(predicate?): TValue
```

```ts
users.sole((user) => user.email === "ada@example.com")
```

### `nth`

Returns every nth entry while preserving the original keys. `step` must be a positive integer.


**Behavior:** preserves keys. Selects indexes `offset`, `offset + step`, ...; step > 0, offset >= 0.
```ts
nth(step: number, offset?: number): Collection<TKey, TValue>
```

```ts
collect([0, 1, 2, 3, 4]).nth(2).items() // [0, 2, 4]
```

### `random`

Returns one random value, or a numerically keyed collection containing up to `count` random values.


**Behavior:** value or `undefined`. Empty collection => `undefined`; unique sampled entries, reindexed from zero; count may not exceed collection size. `random(0)` returns an empty collection without reading random state or shuffling the source.
```ts
random(): TValue | undefined
random(count: number): Collection<number, TValue>
```

```ts
const one = users.random()
// TValue | undefined

const three = users.random(3)
// Collection<number, TValue> containing three distinct sampled entries

users.random(0).items() // []
// No shuffle/RNG work is performed for a zero-sized sample.

// users.random(users.count() + 1)
// RangeError: a sample cannot be larger than the collection.
```

## Transformation

### `map`

Transforms every value while preserving the current keys.


**Behavior:** preserves keys. Callback receives `(value, key, source)` exactly once per entry.
```ts
map<TMapped>(callback): Collection<TKey, TMapped>
```

```ts
collect([1, 2, 3]).map((value) => value * 2).items() // [2, 4, 6]
```

### `mapInto`

Constructs one class instance for each entry using the current value and key.

**Behavior:** preserves keys. Each constructor receives `(value, key)` exactly once per source entry.
```ts
mapInto<TInstance>(constructor): Collection<TKey, TInstance>
```

```ts
class UserRow {
    constructor(readonly user: User, readonly key: string) {}
}

users.mapInto(UserRow)
```

### `mapSpread`

Maps tuple-like collection values by spreading tuple members and then appending the source key.

**Behavior:** preserves keys. Intended for `Collection<TKey, readonly unknown[]>`; callback arguments are `...tuple, key`.
```ts
mapSpread<TMapped>(callback): Collection<TKey, TMapped>
```

```ts
collect(new Map([["a", [2, 3] as const]]))
    .mapSpread((left, right, key) => `${key}:${left + right}`)
    .get("a") // "a:5"
```

### `mapToGroups`

Maps each entry to one group key/value pair and groups mapped values by that key.

**Behavior:** group keys preserve first-seen order; values inside each group preserve source order and are reindexed numerically.
```ts
mapToGroups<TGroupKey, TMapped>(callback): Collection<TGroupKey, Collection<number, TMapped>>
```

```ts
users.mapToGroups((user) => [user.team, user.name] as const)
// Collection<team, Collection<number, name>>
```

### `mapValues`

Semantic alias for `map()` when emphasizing that only values change.


**Behavior:** preserves keys. Alias-style value mapping with the same callback contract as `map()`.
```ts
mapValues<TMapped>(callback): Collection<TKey, TMapped>
```

```ts
users.mapValues((user) => user.name)
```

### `mapKeys`

Transforms each key while keeping its value.


**Behavior:** replaces keys. Duplicate derived keys collapse using `Map` replacement semantics.
```ts
mapKeys<TMappedKey>(callback): Collection<TMappedKey, TValue>
```

```ts
const byDomain = collect(new Map([
    ["ada", { domain: "example.com", name: "Ada" }],
    ["grace", { domain: "example.com", name: "Grace" }],
]))

byDomain.mapKeys((user) => user.domain).entries()
// [["example.com", { domain: "example.com", name: "Grace" }]]
// Duplicate mapped keys use Map replacement semantics: the later value wins.
```

### `mapWithKeys`

Transforms every entry into a new key/value tuple.


**Behavior:** replaces keys and values. Callback returns a `[key, value]` tuple.
```ts
mapWithKeys<TMappedKey, TMappedValue>(callback): Collection<TMappedKey, TMappedValue>
```

```ts
users.mapWithKeys((user) => [user.email, user.name])
```

### `flatMap`

Maps each item to an iterable and flattens one layer into numeric keys.


**Behavior:** numeric keys. Maps each entry to an iterable, concatenates one level, then reindexes.
```ts
flatMap<TMapped>(callback): Collection<number, TMapped>
```

```ts
collect([1, 2]).flatMap((value) => [value, value * 10]).items() // [1, 10, 2, 20]
```

### `flatten`

Recursively flattens iterable values. Strings are treated as terminal values. The default depth is unlimited.


**Behavior:** numeric keys. Flattens iterable values recursively to `depth`; strings are atomic.
```ts
flatten(depth?: number): Collection<number, unknown>
```

```ts
const nested = collect([[[1]], [[2, 3]]])

nested.flatten().items()  // [1, 2, 3]
nested.flatten(1).items() // [[1], [2, 3]]
nested.flatten(0).items() // [[[1]], [[2, 3]]]

collect(["abc", ["def"]]).flatten().items()
// ["abc", "def"] - strings are terminal values, not character iterables
```

### `collapse`

Flattens exactly one iterable layer and infers the nested item type.


**Behavior:** numeric keys. `flatten(1)` with inferred one-layer value type.
```ts
collapse(): Collection<number, FlattenValue<TValue>>
```

```ts
collect([[1, 2], [3]]).collapse().items() // [1, 2, 3]
```

### `collapseWithKeys`

Collapses one layer of keyed nested entry sources while preserving their keys.

**Behavior:** nested sources must yield `[key, value]` entries. Duplicate nested keys use `Map` replacement semantics: later values win while the key keeps its first insertion position.
```ts
collapseWithKeys(): Collection<TNestedKey, TNestedValue>
```

```ts
collect([
    new Map([["a", 1], ["shared", 10]]),
    new Map([["b", 2], ["shared", 20]]),
]).collapseWithKeys().entries()
// [["a", 1], ["shared", 20], ["b", 2]]
```

### `multiply`

Repeats the collection values a fixed number of times.

**Behavior:** numeric keys. Source keys are discarded; multiplier must be a non-negative integer; zero returns an empty collection.
```ts
multiply(multiplier: number): Collection<number, TValue>
```

```ts
collect(["a", "b"]).multiply(2).items()
// ["a", "b", "a", "b"]
```

### `dot`

Flattens nested keyed values into dot-notation keys.

**Behavior:** returns `Collection<string, unknown>`. Supports nested records, arrays, maps and collections; string/number keys only; cycles and unrepresentable keys throw. `depth` is a non-negative integer or `Infinity`. Literal dots in source keys are inherently ambiguous in dot notation.
```ts
dot(depth?: number): Collection<string, unknown>
```

```ts
collect({ user: { profile: { name: "Ada" } } }).dot().entries()
// [["user.profile.name", "Ada"]]

collect({ user: { profile: { name: "Ada" } } }).dot(1).entries()
// [["user.profile", { name: "Ada" }]]
```

### `undot`

Expands dot-notation string or numeric keys into nested objects.

**Behavior:** returns top-level string keys. Path conflicts resolve in source order; generated nested objects use null prototypes to avoid prototype-pollution side effects.
```ts
undot(): Collection<string, unknown>
```

```ts
collect(new Map([
    ["user.name", "Ada"],
    ["user.active", true],
])).undot().get("user")
// { name: "Ada", active: true } (null-prototype object)
```

### `select`

Projects one or more top-level own properties from each collection value.

**Behavior:** preserves collection keys and infers `Pick<TValue, ...>`. Missing or inherited properties are omitted; symbol properties are supported when they are part of `keyof TValue`.
```ts
select<K extends keyof TValue>(key: K): Collection<TKey, Pick<TValue, K>>
select<const K extends readonly (keyof TValue)[]>(keys: K): Collection<TKey, Pick<TValue, K[number]>>
```

```ts
users.select(["id", "name"] as const)
// Collection<TKey, { id: ...; name: ... }>
```

### `pluck`

Extracts a strongly typed nested path from every value while preserving keys.


**Behavior:** preserves keys. Reads a typed nested path from every value.
```ts
pluck(path): Collection<TKey, CollectionPathValue<...>>
```

```ts
users.pluck("profile.email")
```

### `keyBy`

Re-keys values using a typed nested path or callback. Later duplicate keys replace earlier values.


**Behavior:** replaces keys. Later duplicate keys replace earlier values while keeping first key position.
```ts
keyBy(pathOrCallback): Collection<TMappedKey, TValue>
```

```ts
const byEmail = users.keyBy("profile.email")
byEmail.get("ada@example.com")

// A callback can derive non-string keys too.
const byDatabaseId = users.keyBy((user) => user.id)

// If multiple users resolve to the same key, the later value replaces the
// earlier value while that key keeps its first insertion position.
```

## Filtering

### `filter`

Keeps values accepted by a predicate. Type-guard predicates narrow the resulting collection value type.


**Behavior:** preserves keys. Keeps predicate matches; supports TypeScript type guards.
```ts
filter(predicate): Collection<TKey, TValue>
```

```ts
collect([1, null, 2]).filter((value): value is number => value !== null)
```

### `reject`

Removes values for which the predicate returns `true`.


**Behavior:** preserves keys. Exact logical complement of `filter(predicate)`.
```ts
reject(predicate): Collection<TKey, TValue>
```

```ts
users.reject((user) => user.disabled)
```

### `where`

Keeps items whose nested path strictly equals an expected value using `Object.is`.


**Behavior:** preserves keys. Nested-path equality uses `Object.is`.
```ts
where(path, expected): Collection<TKey, TValue>
```

```ts
users.where("role", "admin")

collect([
    { value: Number.NaN },
    { value: 0 },
    { value: -0 },
]).where("value", Number.NaN).keys()
// [0]

// where() uses Object.is, so +0 and -0 are distinct.
```

### `whereNot`

Keeps items whose nested path does not strictly equal an expected value.


**Behavior:** preserves keys. Inverse of `where()`.
```ts
whereNot(path, expected): Collection<TKey, TValue>
```

```ts
users.whereNot("role", "guest")
```

### `whereIn`

Keeps items whose nested path is contained by the supplied iterable.


**Behavior:** preserves keys. Membership uses `Set` / SameValueZero semantics.
```ts
whereIn(path, values): Collection<TKey, TValue>
```

```ts
users.whereIn("role", ["admin", "member"])
```

### `whereNotIn`

Keeps items whose nested path is not contained by the supplied iterable.


**Behavior:** preserves keys. Inverse set membership.
```ts
whereNotIn(path, values): Collection<TKey, TValue>
```

```ts
users.whereNotIn("role", ["blocked"])
```

### `whereNull`

Keeps items whose nested path resolves to `null` or `undefined`.


**Behavior:** preserves keys. Matches only `null` and `undefined`.
```ts
whereNull(path): Collection<TKey, TValue>
```

```ts
users.whereNull("profile.avatar")
```

### `whereNotNull`

Keeps items whose nested path resolves to a non-nullish value.


**Behavior:** preserves keys. Excludes only `null` and `undefined`.
```ts
whereNotNull(path): Collection<TKey, TValue>
```

```ts
users.whereNotNull("profile.avatar")
```

### `whereBetween`

Keeps items whose typed nested value lies inside an inclusive range.

**Behavior:** preserves keys. Both boundaries are inclusive and use the package's deterministic comparator; a reversed range matches nothing.
```ts
whereBetween(path, range): Collection<TKey, TValue>
```

```ts
users.whereBetween("age", [18, 65])
collect([{ score: 10 }, { score: 20 }]).whereBetween("score", [10, 10]).count() // 1
```

### `whereNotBetween`

Keeps items whose typed nested value lies outside an inclusive range.

**Behavior:** preserves keys. Values below the minimum or above the maximum are retained using deterministic comparison.
```ts
whereNotBetween(path, range): Collection<TKey, TValue>
```

```ts
users.whereNotBetween("age", [18, 65])
```

### `whereInstanceOf`

Narrows values to instances of one class or any class in a supplied list.

**Behavior:** preserves keys and narrows the resulting TypeScript value union. An empty class list returns an empty collection.
```ts
whereInstanceOf<TInstance>(type): Collection<TKey, TInstance>
whereInstanceOf(types): Collection<TKey, Extract<TValue, InstanceType<...>>>
```

```ts
const errors = values.whereInstanceOf(Error)
const known = values.whereInstanceOf([TypeError, RangeError] as const)
```

## Predicates

### `contains`

Determines whether the collection contains a value using `Object.is`, or whether a predicate matches any item.


**Behavior:** `boolean`. Uses `Object.is`; function arguments are interpreted as predicates; short-circuits on first match.
```ts
contains(valueOrPredicate): boolean
```

```ts
numbers.contains(10)
users.contains((user) => user.enabled)

const handler = () => {}
const handlers = collect([handler])

// A function argument is interpreted as a predicate. For function-valued
// collections, compare the function from inside a predicate instead.
handlers.contains((value) => value === handler) // true
```

### `doesntContain`

Inverse of `contains()`.


**Behavior:** `boolean`. Logical inverse of `contains()`.
```ts
doesntContain(valueOrPredicate): boolean
```

```ts
users.doesntContain((user) => user.blocked)
```

### `every`

Returns `true` when every item satisfies a predicate. Empty collections return `true`.


**Behavior:** `boolean`. Short-circuits on first failure; empty collection => `true`.
```ts
every(predicate): boolean
```

```ts
numbers.every((value) => value > 0)
```

### `some`

Returns `true` when at least one item satisfies a predicate.


**Behavior:** `boolean`. Short-circuits on first match; empty collection => `false`.
```ts
some(predicate): boolean
```

```ts
users.some((user) => user.enabled)
```

## Subsets & Windows

### `only`

Keeps entries whose keys appear in the supplied iterable.


**Behavior:** preserves keys. Result follows source order, not requested-key order.
```ts
only(keys: Iterable<TKey>): Collection<TKey, TValue>
```

```ts
users.only(["ada", "grace"])
```

### `except`

Removes entries whose keys appear in the supplied iterable.


**Behavior:** preserves keys. Unknown keys are ignored.
```ts
except(keys: Iterable<TKey>): Collection<TKey, TValue>
```

```ts
users.except(["blocked"])
```

### `take`

Takes items from the start when positive or from the end when negative.


**Behavior:** preserves keys. Positive => first `n`; negative => last `abs(n)`; zero => empty.
```ts
take(limit: number): Collection<TKey, TValue>
```

```ts
collect([1, 2, 3, 4]).take(-2).items() // [3, 4]
```

### `skip`

Skips items from the start when positive or from the end when negative.


**Behavior:** preserves keys. Positive skips from front; negative skips from end.
```ts
skip(count: number): Collection<TKey, TValue>
```

```ts
collect([1, 2, 3, 4]).skip(2).items() // [3, 4]
```

### `slice`

Returns a native-style slice while preserving entry keys.


**Behavior:** preserves keys. Negative offset counts from end; second argument is a length, not an end index.
```ts
slice(offset: number, length?: number): Collection<TKey, TValue>
```

```ts
const values = collect([1, 2, 3, 4, 5])

values.slice(1, 2).items()  // [2, 3]
values.slice(-2).items()    // [4, 5]
values.slice(-3, 2).items() // [3, 4]
values.slice(99, 2).items() // []

// The second argument is a length, not an end index.
```

### `takeUntil`

Takes values until a predicate matches. The matching value is excluded.


**Behavior:** preserves keys. Stops before first matching entry; matching entry excluded.
```ts
takeUntil(predicate): Collection<TKey, TValue>
```

```ts
collect([1, 2, 3, 4]).takeUntil((value) => value === 3).items() // [1, 2]
```

### `takeWhile`

Takes values while a predicate remains true.


**Behavior:** preserves keys. Stops at first predicate failure.
```ts
takeWhile(predicate): Collection<TKey, TValue>
```

```ts
collect([1, 2, 3, 4]).takeWhile((value) => value < 3).items() // [1, 2]
```

### `skipUntil`

Skips values until a predicate matches and includes the matching item.


**Behavior:** preserves keys. Starts at first match; matching entry included.
```ts
skipUntil(predicate): Collection<TKey, TValue>
```

```ts
collect([1, 2, 3, 4]).skipUntil((value) => value === 3).items() // [3, 4]
```

### `skipWhile`

Skips values while a predicate remains true.


**Behavior:** preserves keys. Starts at first predicate failure.
```ts
skipWhile(predicate): Collection<TKey, TValue>
```

```ts
collect([1, 2, 3, 4]).skipWhile((value) => value < 3).items() // [3, 4]
```

### `chunk`

Splits entries into fixed-size nested collections. `size` must be a positive integer.


**Behavior:** outer numeric keys. Fixed-size nested collections; original keys preserved inside chunks.
```ts
chunk(size: number): Collection<number, Collection<TKey, TValue>>
```

```ts
collect([1, 2, 3, 4, 5]).chunk(2).map((chunk) => chunk.items()).items()
```

### `chunkWhile`

Builds variable-sized chunks while a continuation predicate remains true.

**Behavior:** numeric outer keys; original keys inside chunks. The first item starts a chunk without invoking the predicate; subsequent calls receive `(value, key, currentChunk)` where `currentChunk` does not yet contain the candidate.
```ts
chunkWhile(predicate): Collection<number, Collection<TKey, TValue>>
```

```ts
collect([1, 2, 4, 5, 9]).chunkWhile((value, _key, chunk) =>
    value - (chunk.last() ?? value) <= 1,
).items().map((chunk) => chunk.items())
// [[1, 2], [4, 5], [9]]
```

### `sliding`

Creates overlapping fixed-size windows with a configurable positive step.


**Behavior:** outer numeric keys. Emits complete windows only.
```ts
sliding(size: number, step?: number): Collection<number, Collection<TKey, TValue>>
```

```ts
collect([1, 2, 3, 4]).sliding(2).map((window) => window.items()).items()
```

### `split`

Splits the collection into approximately equal groups.


**Behavior:** outer numeric keys. Balanced groups; earlier groups receive remainder items; never emits empty groups.
```ts
split(groups: number): Collection<number, Collection<TKey, TValue>>
```

```ts
collect([1, 2, 3, 4, 5]).split(2)
```

### `splitIn`

Splits into groups by filling earlier groups completely before placing the remainder in the final group.

**Behavior:** numeric outer keys; source keys remain inside groups. Unlike `split()`, remainder items are not distributed across early groups.
```ts
splitIn(groups: number): Collection<number, Collection<TKey, TValue>>
```

```ts
collect([1, 2, 3, 4, 5]).splitIn(2).items().map((group) => group.items())
// [[1, 2, 3], [4, 5]]
```

### `forPage`

Returns the positional slice for a one-based page number.

**Behavior:** preserves source keys. `page` and `perPage` must be positive integers; pages beyond the end return an empty collection.
```ts
forPage(page: number, perPage: number): Collection<TKey, TValue>
```

```ts
collect([10, 20, 30, 40, 50]).forPage(2, 2).items()
// [30, 40]
```

### `pad`

Pads values to an absolute target size. Positive sizes append; negative sizes prepend.


**Behavior:** numeric keys. Positive pads right, negative pads left; always reindexes even when no padding is needed.
```ts
pad<TPad>(size: number, value: TPad): Collection<number, TValue | TPad>
```

```ts
collect([1, 2]).pad(4, 0).items() // [1, 2, 0, 0]
```

### `partition`

Splits items into matching and rejected collections.


**Behavior:** two collections, preserved keys. Returns `[accepted, rejected]`, both preserving source order.
```ts
partition(predicate): readonly [Collection<TKey, TValue>, Collection<TKey, TValue>]
```

```ts
const [enabled, disabled] = users.partition((user) => user.enabled)
```

## Ordering

### `reverse`

Reverses iteration order while preserving keys.


**Behavior:** preserves keys. Reverses entry order only.
```ts
reverse(): Collection<TKey, TValue>
```

```ts
collect([1, 2, 3]).reverse().items() // [3, 2, 1]
```

### `shuffle`

Returns a new collection with randomized entry order.


**Behavior:** preserves keys. Randomizes entry order while keeping every key attached to its value.
```ts
shuffle(): Collection<TKey, TValue>
```

```ts
const randomized = users.shuffle()
```

### `sort`

Sorts entries using a comparator that receives both values and keys.


**Behavior:** preserves keys. Stable sort; comparator receives both values and both keys.
```ts
sort(comparator): Collection<TKey, TValue>
```

```ts
users.sort((left, right) => left.age - right.age)
```

### `sortBy`

Sorts ascending using a typed nested path or callback result.


**Behavior:** preserves keys. Stable ascending scalar comparison. Callback selectors are resolved exactly once per source entry before sorting.
```ts
sortBy(pathOrCallback): Collection<TKey, TValue>
```

```ts
const ranked = users.sortBy("profile.score")

// Ties are stable: users with equal scores keep their original order.
// A callback selector is resolved once per source entry before sorting.
const byComputedScore = users.sortBy((user) =>
    user.profile.score * user.weight,
)
```

### `sortByDesc`

Sorts descending using a typed nested path or callback result.


**Behavior:** preserves keys. Stable descending scalar comparison. Callback selectors are resolved exactly once per source entry before sorting.
```ts
sortByDesc(pathOrCallback): Collection<TKey, TValue>
```

```ts
const highestFirst = users.sortByDesc("profile.score")

// Descending order reverses the scalar comparator, not the order of ties.
// Equal selected values remain stable.
```

### `sortDesc`

Sorts values in descending deterministic order while preserving their keys.

**Behavior:** preserves keys. Equal values retain their original relative order.
```ts
sortDesc(): Collection<TKey, TValue>
```

```ts
collect(new Map([["a", 2], ["b", 3], ["c", 2]])).sortDesc().keys()
// ["b", "a", "c"]
```

### `sortKeysUsing`

Sorts entries by their keys using a custom comparator.

**Behavior:** preserves key/value pairs. Comparator equality keeps original relative order under JavaScript's stable sort semantics.
```ts
sortKeysUsing(comparator: (left: TKey, right: TKey) => number): Collection<TKey, TValue>
```

```ts
collection.sortKeysUsing((left, right) => String(left).localeCompare(String(right)))
```

### `sortKeys`

Sorts entries by key in ascending deterministic order.


**Behavior:** preserves key/value pairs. Orders by built-in scalar key comparator.
```ts
sortKeys(): Collection<TKey, TValue>
```

```ts
roles.sortKeys()
```

### `sortKeysDesc`

Sorts entries by key in descending deterministic order.


**Behavior:** preserves key/value pairs. Descending key order.
```ts
sortKeysDesc(): Collection<TKey, TValue>
```

```ts
roles.sortKeysDesc()
```

## Grouping

### `groupBy`

Groups values into nested collections using a typed path or callback result.


**Behavior:** derived outer keys. First-seen group order; each nested group preserves original keys.
```ts
groupBy(pathOrCallback): Collection<TGroupKey, Collection<TKey, TValue>>
```

```ts
const byRole = users.groupBy("role")

byRole.get("admin")?.keys()
// Original user keys are preserved inside the nested group.

byRole.keys()
// Group keys follow first-seen order.
```

### `countBy`

Counts values by a typed path or callback result.


**Behavior:** derived keys. One selector evaluation per source entry.
```ts
countBy(pathOrCallback): Collection<TGroupKey, number>
```

```ts
users.countBy("role").get("member")
```

## Set Operations

### `unique`

Keeps the first item for each unique selected value.


**Behavior:** preserves keys. Keeps first entry for each SameValueZero selector result.
```ts
unique(selector?): Collection<TKey, TValue>
```

```ts
collect([1, 1, 2, 1]).unique().items() // [1, 2]

users.unique((user) => user.email)
// Keeps the first user for each email and preserves that user's source key.
```

### `duplicates`

Keeps items whose selected value has already appeared earlier in iteration order.


**Behavior:** preserves keys. Returns every repeated occurrence after the first.
```ts
duplicates(selector?): Collection<TKey, TValue>
```

```ts
collect([1, 1, 2, 1]).duplicates().items() // [1, 1]

users.duplicates((user) => user.email)
// Every repeated occurrence after the first is returned.
```

### `diff`

Keeps values not present in another iterable.


**Behavior:** preserves keys. Keeps values absent from the comparison set.
```ts
diff(values: Iterable<TValue>): Collection<TKey, TValue>
```

```ts
collect([1, 2, 3]).diff([2, 4]).items() // [1, 3]
```

### `intersect`

Keeps values also present in another iterable.


**Behavior:** preserves keys. Keeps values present in the comparison set.
```ts
intersect(values: Iterable<TValue>): Collection<TKey, TValue>
```

```ts
collect([1, 2, 3]).intersect([2, 4]).items() // [2]
```

### `diffKeys`

Keeps entries whose keys are absent from another key iterable.


**Behavior:** preserves keys. Compares keys only.
```ts
diffKeys(keys: Iterable<TKey>): Collection<TKey, TValue>
```

```ts
users.diffKeys(["blocked"])
```

### `intersectByKeys`

Keeps entries whose keys are present in another key iterable.


**Behavior:** preserves keys. Compares keys only.
```ts
intersectByKeys(keys: Iterable<TKey>): Collection<TKey, TValue>
```

```ts
users.intersectByKeys(["ada", "grace"])
```

### `diffAssoc`

Keeps entries whose exact key/value pair is absent from another entry iterable.

**Behavior:** preserves source keys. Keys use `Map` identity and values use `Object.is`; a missing key is distinct from a present key whose value is `undefined`.
```ts
diffAssoc(entries: Iterable<readonly [TKey, TValue]>): Collection<TKey, TValue>
```

```ts
collect(new Map([["a", 1], ["b", 2]])).diffAssoc(new Map([["a", 1]])).keys()
// ["b"]
```

### `intersectAssoc`

Keeps entries whose exact key/value pair exists in another entry iterable.

**Behavior:** preserves source keys and order. Both the key and `Object.is` value must match.
```ts
intersectAssoc(entries: Iterable<readonly [TKey, TValue]>): Collection<TKey, TValue>
```

```ts
collect(new Map([["a", 1], ["b", 2]])).intersectAssoc(new Map([["b", 2]])).entries()
// [["b", 2]]
```

### `union`

Adds entries whose keys do not already exist. Existing entries win.


**Behavior:** preserves existing order. Existing keys win; first incoming value wins for a new duplicate key.
```ts
union(entries: Iterable<readonly [TKey, TValue]>): Collection<TKey, TValue>
```

```ts
const current = collect(new Map([
    ["a", 1],
    ["b", 2],
]))

current.union([
    ["b", 20],
    ["c", 3],
    ["c", 30],
]).entries()
// [["a", 1], ["b", 2], ["c", 3]]
// Existing keys win; for a new duplicated incoming key, the first value wins.
```

## Immutable Updates

### `merge`

Merges entries into a new collection. Incoming values replace entries with matching keys.


**Behavior:** preserves/reuses key positions. Incoming values overwrite; later incoming duplicates win.
```ts
merge<TMergeKey, TMergeValue>(entries): Collection<TKey | TMergeKey, TValue | TMergeValue>
```

```ts
const current = collect(new Map([
    ["a", 1],
    ["b", 2],
]))

current.merge([
    ["b", 20],
    ["c", 3],
    ["c", 30],
]).entries()
// [["a", 1], ["b", 20], ["c", 30]]
// Incoming values overwrite; later incoming duplicates win.
```

### `replace`

Replaces values only for keys that already exist in the collection.


**Behavior:** preserves keys. Updates existing keys only; never adds unknown keys.
```ts
replace(entries: Iterable<readonly [TKey, TValue]>): Collection<TKey, TValue>
```

```ts
const current = collect(new Map([
    ["a", 1],
    ["b", 2],
]))

current.replace([
    ["b", 20],
    ["c", 3],
]).entries()
// [["a", 1], ["b", 20]]
// Unknown keys are ignored; replace() never grows the key set.
```

### `with`

Returns a new collection with one key/value pair inserted or replaced.


**Behavior:** preserves/reuses key position. Replaces existing key or appends a new key.
```ts
with<TNewKey, TNewValue>(key, value): Collection<TKey | TNewKey, TValue | TNewValue>
```

```ts
const next = settings.with("theme", "dark")
```

### `append`

Appends a value using a new numeric key. Finite numeric keys are inspected to choose the natural successor without ever replacing an existing entry.


**Behavior:** adds numeric key. Uses one greater than the largest finite numeric key when that successor is representable. `NaN` and infinite keys are never replaced; precision edge cases fall back to the first free non-negative integer.
```ts
append<TAppend>(value): Collection<TKey | number, TValue | TAppend>
```

```ts
collect([1, 2]).append(3).entries()
// [[0, 1], [1, 2], [2, 3]]

collect(new Map<string | number, string>([
    ["name", "value"],
    [5, "five"],
])).append("next").entries()
// [["name", "value"], [5, "five"], [6, "next"]]

// NaN and ±Infinity are never treated as replaceable successor positions.
```

### `prepend`

Prepends a value and returns a numerically re-keyed collection.


**Behavior:** numeric keys. Places value first and reindexes every value.
```ts
prepend<TPrepend>(value): Collection<number, TValue | TPrepend>
```

```ts
collect([2, 3]).prepend(1).items() // [1, 2, 3]
```

### `remove`

Returns a new collection without the supplied key.


**Behavior:** preserves remaining keys. Missing key is a no-op in content, but still returns a new collection.
```ts
remove(key: TKey): Collection<TKey, TValue>
```

```ts
const next = users.remove("blocked")
```

## Combining

### `combine`

Uses this collection's values as keys and another iterable's values as the corresponding values.

**Behavior:** returns `Collection<TValue, TCombined>`. Both sides must have exactly the same number of items or a `RangeError` is thrown; duplicate generated keys use `Map` last-write semantics. The supplied iterable is consumed once.
```ts
combine<TCombined>(values: Iterable<TCombined>): Collection<TValue, TCombined>
```

```ts
collect(["name", "age"]).combine(["Ada", 37]).entries()
// [["name", "Ada"], ["age", 37]]
```

### `concat`

Appends values from another iterable, collection or map while ignoring the appended source's keys.

**Behavior:** existing source keys are retained; appended values receive successive available numeric keys. Neither input is mutated.
```ts
concat<TConcat>(source): Collection<TKey | number, TValue | TConcat>
```

```ts
collect(new Map([["first", 1]])).concat(new Map([["ignored", 2]])).entries()
// [["first", 1], [0, 2]]
```

### `flip`

Swaps every entry's value and key.

**Behavior:** values become keys. Duplicate values collapse with `Map` last-write semantics, while the first insertion position of that key is retained.
```ts
flip(): Collection<TValue, TKey>
```

```ts
collect(new Map([["a", "x"], ["b", "y"]])).flip().entries()
// [["x", "a"], ["y", "b"]]
```

### `zip`

Combines values by position. Missing positions are represented by `undefined`.


**Behavior:** numeric keys of pairs. Length is the longer side; missing positions are `undefined`.
```ts
zip<TOther>(values): Collection<number, readonly [TValue | undefined, TOther | undefined]>
```

```ts
collect([1, 2, 3]).zip(["a"]).items()
// [[1, "a"], [2, undefined], [3, undefined]]

collect([1]).zip(["a", "b"]).items()
// [[1, "a"], [undefined, "b"]]

// zip() follows the longer side and always reindexes the resulting pairs.
```

### `crossJoin`

Returns the Cartesian product of collection values and another iterable.


**Behavior:** numeric keys of pairs. Left-major Cartesian product; either empty side => empty.
```ts
crossJoin<TOther>(values): Collection<number, readonly [TValue, TOther]>
```

```ts
collect([1, 2]).crossJoin(["a", "b"]).items()
// [[1, "a"], [1, "b"], [2, "a"], [2, "b"]]

// Either empty side produces an empty collection. The right iterable is
// materialized once, so one-shot generators are supported.
```

## Reduction & Flow

### `reduce`

Reduces entries into a native accumulated result.


**Behavior:** native result. Visits in collection order and always requires an explicit initial value.
```ts
reduce<TResult>(callback, initial): TResult
```

```ts
const total = collect([1, 2, 3]).reduce((sum, value) => sum + value, 0)
```

### `reduceSpread`

Reduces entries while carrying multiple accumulator values as a tuple.

**Behavior:** native tuple result. Reducer receives `...carry, value, key` once per entry and must return an array/tuple of the same accumulator shape; a non-array result throws `TypeError`. Readonly tuples are accepted.
```ts
reduceSpread<TCarry extends unknown[]>(callback, ...initial: TCarry): TCarry
```

```ts
collect([2, 3, 5]).reduceSpread(
    (sum, count, value): [number, number] => [sum + value, count + 1],
    0,
    0,
)
// [10, 3]
```

### `each`

Executes a callback for each entry and returns the same collection. Returning `false` stops iteration early.


**Behavior:** same collection instance. Stops only when callback returns literal `false`.
```ts
each(callback): this
```

```ts
users.each((user) => {
    if (user.disabled) return false // stop iteration immediately
    audit(user)
})

// Only literal false stops iteration. undefined and other return values continue.
```

### `eachSpread`

Executes a callback for tuple-like values by spreading tuple members and then appending the source key.

**Behavior:** returns the same collection instance. Literal `false` stops iteration immediately; empty collections do not invoke the callback.
```ts
eachSpread(callback): Collection<TKey, TChunk>
```

```ts
rows.eachSpread((left, right, key) => {
    console.log(key, left, right)
})
```

### `tap`

Runs a side-effect callback with the collection and returns the same instance.


**Behavior:** same collection instance. Executes callback once for side effects.
```ts
tap(callback): this
```

```ts
users.tap((collection) => console.log(collection.count())).filter((user) => user.enabled)
```

### `pipe`

Passes the collection to a callback and returns the callback result.


**Behavior:** callback result. Does not wrap the callback result.
```ts
pipe<TResult>(callback): TResult
```

```ts
const count = users.pipe((collection) => collection.count())
```

### `pipeInto`

Constructs a class with the current collection as its constructor argument.

**Behavior:** returns the constructed instance and passes the exact same collection instance.
```ts
pipeInto<TInstance>(constructor): TInstance
```

```ts
class Summary {
    constructor(readonly users: Collection<string, User>) {}
}

const summary = users.pipeInto(Summary)
```

### `pipeThrough`

Passes a value through a sequence of callbacks from left to right.

**Behavior:** an empty callback list returns the same collection; typed tuple overloads infer pipelines up to five stages and arbitrary longer callback arrays are supported with an `unknown` result type.
```ts
pipeThrough(callbacks: readonly []): this
pipeThrough(callbacks: readonly ((value: any) => any)[]): unknown
```

```ts
const label = users.pipeThrough([
    (items: Collection<string, User>) => items.count(),
    (count: number) => `users:${count}`,
] as const)
```

### `when`

Runs a collection transformation when a condition is true; otherwise returns the current collection.


**Behavior:** collection. Runs callback only when condition is true; otherwise returns same instance.
```ts
when(condition, callback): Collection<TKey, TValue>
```

```ts
const result = users.when(adminOnly, (items) =>
    items.where("role", "admin"),
)

// When adminOnly is false, `result === users` is true: the callback is not
// evaluated and no unnecessary collection instance is created.
```

### `unless`

Runs a collection transformation when a condition is false.


**Behavior:** collection. Runs callback only when condition is false; otherwise returns same instance.
```ts
unless(condition, callback): Collection<TKey, TValue>
```

```ts
users.unless(includeDisabled, (items) => items.whereNot("disabled", true))
```

### `whenEmpty`

Runs a collection transformation only when the collection is empty.

**Behavior:** selected callback result or the same collection. An optional fallback runs only when the collection is not empty.
```ts
whenEmpty(callback, fallback?): Collection<TKey, TValue>
```

```ts
users.whenEmpty(() => fallbackUsers)
```

### `whenNotEmpty`

Runs a collection transformation only when the collection is not empty.

**Behavior:** selected callback result or the same collection. An optional fallback runs only for an empty collection.
```ts
whenNotEmpty(callback, fallback?): Collection<TKey, TValue>
```

```ts
users.whenNotEmpty((items) => items.take(10))
```

### `unlessEmpty`

Alias-style conditional that runs a transformation unless the collection is empty.

**Behavior:** equivalent to `whenNotEmpty()` including fallback behavior.
```ts
unlessEmpty(callback, fallback?): Collection<TKey, TValue>
```

```ts
users.unlessEmpty((items) => items.take(10))
```

### `unlessNotEmpty`

Alias-style conditional that runs a transformation unless the collection is not empty.

**Behavior:** equivalent to `whenEmpty()` including fallback behavior.
```ts
unlessNotEmpty(callback, fallback?): Collection<TKey, TValue>
```

```ts
users.unlessNotEmpty(() => fallbackUsers)
```

## Aggregates

### `sum`

Sums numeric values selected by an optional callback.


**Behavior:** `number`. Default selector is `Number(value)`; empty => `0`.
```ts
sum(selector?): number
```

```ts
orders.sum((order) => order.total)
```

### `avg`

Alias for `average()`.


**Behavior:** number or `undefined`. Alias of `average()`.
```ts
avg(selector?): number | undefined
```

```ts
orders.avg((order) => order.total)
```

### `average`

Returns the arithmetic average of selected numeric values, or `undefined` for an empty collection.


**Behavior:** number or `undefined`. Empty => `undefined`.
```ts
average(selector?): number | undefined
```

```ts
orders.average((order) => order.total)
```

### `percentage`

Returns the percentage of items that satisfy a predicate.

**Behavior:** number or `undefined`. Empty collections return `undefined` without invoking the predicate; precision defaults to 2 and must be an integer, including negative integers for coarser rounding.
```ts
percentage(predicate, precision?: number): number | undefined
```

```ts
collect([1, 2, 3]).percentage((value) => value > 1) // 66.67
collect([] as number[]).percentage(() => true) // undefined
```

### `min`

Returns the minimum selected value using deterministic scalar comparison.


**Behavior:** selected value or `undefined`. Returns the selected comparable, not the original source item.
```ts
min(selector?): TComparable | undefined
```

```ts
const age = users.min((user) => user.age)
// number | undefined

// min() returns the selected comparable, not the user object whose age won.
collect([] as number[]).min() // undefined
```

### `max`

Returns the maximum selected value using deterministic scalar comparison.


**Behavior:** selected value or `undefined`. Returns the selected comparable, not the original source item.
```ts
max(selector?): TComparable | undefined
```

```ts
const age = users.max((user) => user.age)
// number | undefined

// max() returns the selected comparable, not the original source item.
collect([] as number[]).max() // undefined
```

### `median`

Returns the median selected numeric value, or `undefined` for an empty collection.


**Behavior:** number or `undefined`. Sorts selected numeric values using the same deterministic ordering used by the collection ordering helpers; `NaN` sorts after real numbers. For an even count, returns the mean of the middle pair.
```ts
median(selector?): number | undefined
```

```ts
orders.median((order) => order.total)
collect([Number.NaN, 1, 2]).median() // 2
```

### `mode`

Returns every selected value tied for the highest frequency.


**Behavior:** readonly array. Returns every highest-frequency selected value in first-seen order; empty => `[]`.
```ts
mode(selector?): readonly TMode[]
```

```ts
collect([1, 2, 2, 3, 3]).mode() // [2, 3]
```

## Strings

### `join`

Converts values to strings and joins them. An optional final glue can be used before the last item.


**Behavior:** string. Optional final glue is used only before the final item.
```ts
join(glue: string, finalGlue?: string): string
```

```ts
collect(["Ada", "Grace", "Linus"]).join(", ", " and ")
// "Ada, Grace and Linus"

collect(["Ada", "Grace"]).join(", ", " & ")
// "Ada & Grace"

collect(["Ada"]).join(", ", " & ")
// "Ada" - finalGlue is only relevant when at least two values exist
```

### `implode`

Extracts a nested path, converts each result to string and joins with the supplied glue.


**Behavior:** string. Plucks a typed path, stringifies values, then joins.
```ts
implode(path, glue: string): string
```

```ts
users.implode("profile.email", ", ")
```

## Iteration

### `[Symbol.iterator]`

Returns the underlying key/value entry iterator. This makes collections compatible with `for...of` and spread syntax.


**Behavior:** entry iterator. Iterates `[key, value]` pairs and can be passed directly to `new Map(...)`.
```ts
[Symbol.iterator](): Iterator<[TKey, TValue]>
```

```ts
for (const [key, value] of collection) {
    console.log(key, value)
}
```

## Errors

### `CollectionItemNotFoundError`

Thrown by operations that require one matching item when no item exists, including `firstOrFail()`, `lastOrFail()` and the zero-match case of `sole()`.

```ts
import {
    CollectionItemNotFoundError,
    collect,
} from "@obvia/collections"

try {
    collect([]).firstOrFail()
} catch (error) {
    if (error instanceof CollectionItemNotFoundError) {
        console.error("No item matched")
    }
}
```

### `CollectionMultipleItemsError`

Thrown by `sole()` when more than one value matches.

```ts
import {
    CollectionMultipleItemsError,
    collect,
} from "@obvia/collections"

try {
    collect([1, 2, 3]).sole((value) => value > 1)
} catch (error) {
    if (error instanceof CollectionMultipleItemsError) {
        console.error("More than one item matched")
    }
}
```

## Type Narrowing

`filter()` accepts user-defined type guards and carries the narrowed value type into the returned collection.

```ts
const values: readonly (number | null)[] = [1, null, 2]

const numbers = collect(values).filter(
    (value): value is number => value !== null,
)

// Collection<number, number>
numbers
```

## Key Preservation

Operations preserve keys when there is a meaningful one-to-one relationship with the source entries.

```ts
const users = collect(new Map([
    ["ada", { name: "Ada" }],
    ["grace", { name: "Grace" }],
]))

users.map((user) => user.name).keys()
// ["ada", "grace"]

users.filter((user) => user.name.startsWith("A")).keys()
// ["ada"]
```

Operations that fundamentally create positional results use numeric keys, including `values`, `flatMap`, `flatten`, `collapse`, `chunk`, `sliding`, `split`, `pad`, `prepend`, `zip` and `crossJoin`.

## Immutability

Collection operations do not mutate their source.

```ts
const original = collect(new Map([
    ["theme", "system"],
]))

const changed = original.with("theme", "dark")

original.get("theme") // "system"
changed.get("theme") // "dark"
```

`toArray()`, `toMap()` and `toObject()` return defensive containers rather than exposing internal storage.

## `undefined` Values

A stored `undefined` value is different from a missing key. Use `has()` when presence matters.

```ts
const values = collect(new Map([
    ["present", undefined],
]))

values.has("present") // true
values.get("present") // undefined
values.getOr("present", "fallback") // undefined
values.getOr("missing", "fallback") // "fallback"
```


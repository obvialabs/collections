# @obvia/collections

Immutable, fluent and deeply typed collections for TypeScript.

`@obvia/collections` provides a small runtime `Collection<TKey, TValue>` abstraction with rich transformation, filtering, ordering, grouping, set, aggregation and composition operations. It also includes `createCollection()` for keyed definitions where literal keys become strongly typed item IDs and safe keys remain directly accessible from the collection instance.

## Installation

```bash
npm install @obvia/collections
```

```bash
pnpm add @obvia/collections
```

```bash
bun add @obvia/collections
```

```bash
yarn add @obvia/collections
```

## Quick Start

```ts
import { collect, createCollection } from "@obvia/collections"

const numbers = collect([1, 2, 3, 4, 5])

const result = numbers
    .filter((value) => value % 2 !== 0)
    .map((value) => value * 10)
    .take(2)

console.log(result.items()) // [10, 30]

const slides = createCollection({
    canvas: {
        title: "Canvas",
        enabled: true,
    },
    security: {
        title: "Security",
        enabled: false,
    },
})

slides.canvas.id // "canvas"
slides.security.title // "Security"
slides.count() // 2
slides.keys() // ["canvas", "security"]
```

## Design

- **Immutable:** transformation and update operations return new collections instead of mutating the source instance.
- **Fluent:** collection-producing methods can be chained without dropping into native arrays between operations.
- **Key-aware:** operations preserve keys whenever the operation does not explicitly re-key the data.
- **Deeply typed:** nested dot paths such as `"profile.email"` are inferred and validated by TypeScript.
- **Definition-friendly:** `createCollection()` turns object keys into literal item IDs without repeating `id` fields.
- **Collision-safe:** definition keys such as `map`, `filter`, `count`, `constructor` or `toString` remain available through `get()` without shadowing runtime methods.
- **Iterable:** every collection implements `Iterable<[TKey, TValue]>` and works with `for...of`, spread syntax and other JavaScript iteration APIs.
- **Runtime-neutral:** the package has no runtime dependencies and is emitted as standard ESM JavaScript.
- **Tree-shakable package surface:** public entry points are explicit and the package is marked `sideEffects: false`.

## API Overview

| Area | API |
| --- | --- |
| Creation | `Collection`, `collect`, `createCollection` |
| State | `count`, `empty`, `notEmpty` |
| Access | `get`, `getOr`, `has`, `hasAny`, `hasAll`, `search`, `first`, `firstOrFail`, `last`, `lastOrFail`, `sole`, `nth`, `random` |
| Values | `items`, `all`, `keys`, `entries`, `values` |
| Conversion | `toArray`, `toMap`, `toObject` |
| Transform | `map`, `mapValues`, `mapKeys`, `mapWithKeys`, `flatMap`, `flatten`, `collapse`, `pluck`, `keyBy` |
| Filter | `filter`, `reject`, `where`, `whereNot`, `whereIn`, `whereNotIn`, `whereNull`, `whereNotNull` |
| Predicates | `contains`, `doesntContain`, `every`, `some` |
| Subsets | `only`, `except`, `take`, `skip`, `slice`, `takeUntil`, `takeWhile`, `skipUntil`, `skipWhile`, `chunk`, `sliding`, `split`, `pad`, `partition` |
| Ordering | `reverse`, `shuffle`, `sort`, `sortBy`, `sortByDesc`, `sortKeys`, `sortKeysDesc` |
| Grouping | `groupBy`, `countBy` |
| Sets | `unique`, `duplicates`, `diff`, `intersect`, `diffKeys`, `intersectByKeys`, `union` |
| Updates | `merge`, `replace`, `with`, `append`, `prepend`, `remove` |
| Combining | `zip`, `crossJoin` |
| Reduction | `reduce`, `each`, `tap`, `pipe`, `when`, `unless` |
| Aggregates | `sum`, `avg`, `average`, `min`, `max`, `median`, `mode` |
| Strings | `join`, `implode` |
| Iteration | `[Symbol.iterator]` |

## Creating Collections

### `collect`

Creates a collection from an array, readonly map, plain object, iterable of entries, existing collection or no source at all.

```ts
import { collect } from "@obvia/collections"

const empty = collect()
const numbers = collect([10, 20, 30])
const roles = collect(new Map([
    ["admin", 1],
    ["member", 2],
]))
const object = collect({ active: true, queued: false })
```

Arrays use numeric keys. Maps and entry iterables preserve their original keys. Plain objects preserve their property names. Passing an existing `Collection` returns the same collection instance.

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
})

definitions.security.label // "Security"
definitions.get("map")?.label // "Map"
definitions.get("constructor")?.label // "Constructor"

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

## Collection

The following sections document the runtime methods exposed by `Collection<TKey, TValue>`.

## State & Values

### `count`

Returns the number of entries in the collection.

```ts
count(): number
```

```ts
const count = collect([10, 20, 30]).count() // 3
```

### `empty`

Returns `true` when the collection contains no entries.

```ts
empty(): boolean
```

```ts
collect([]).empty() // true
```

### `notEmpty`

Returns `true` when the collection contains at least one entry.

```ts
notEmpty(): boolean
```

```ts
collect([1]).notEmpty() // true
```

### `items`

Returns collection values in their current order as a readonly array.

```ts
items(): readonly TValue[]
```

```ts
collect(new Map([["a", 1], ["b", 2]])).items() // [1, 2]
```

### `all`

Alias for `items()`.

```ts
all(): readonly TValue[]
```

```ts
collect([1, 2]).all() // [1, 2]
```

### `keys`

Returns collection keys in their current order.

```ts
keys(): readonly TKey[]
```

```ts
collect({ active: true, queued: false }).keys() // ["active", "queued"]
```

### `entries`

Returns readonly key/value tuples in their current order.

```ts
entries(): readonly (readonly [TKey, TValue])[]
```

```ts
collect(new Map([["a", 1]])).entries() // [["a", 1]]
```

### `values`

Returns the same values in a new collection with contiguous numeric keys.

```ts
values(): Collection<number, TValue>
```

```ts
collect(new Map([["a", 10], ["b", 20]])).values().keys() // [0, 1]
```

## Conversion

### `toArray`

Returns a mutable native array copy of the collection values.

```ts
toArray(): TValue[]
```

```ts
const array = collect([1, 2, 3]).toArray()
```

### `toMap`

Returns a defensive `Map` copy of the collection.

```ts
toMap(): ReadonlyMap<TKey, TValue>
```

```ts
const map = collect({ a: 1, b: 2 }).toMap()
```

### `toObject`

Converts the collection into a plain null-prototype object. Runtime keys must be valid property keys.

```ts
toObject(): Record<PropertyKey, TValue>
```

```ts
collect(new Map([["draft", true]])).toObject() // { draft: true }
```

## Access

### `get`

Returns the value stored at a key, or `undefined` when the key is missing.

```ts
get(key: TKey): TValue | undefined
```

```ts
users.get("ada")
```

### `getOr`

Returns the keyed value when present; otherwise resolves a value or callback fallback. Existing `undefined` values are not treated as missing.

```ts
getOr(key: TKey, fallback: TValue | ((key: TKey) => TValue)): TValue
```

```ts
settings.getOr("theme", () => "system")
```

### `has`

Determines whether a key exists.

```ts
has(key: TKey): boolean
```

```ts
users.has("ada")
```

### `hasAny`

Returns `true` when at least one provided key exists.

```ts
hasAny(keys: Iterable<TKey>): boolean
```

```ts
users.hasAny(["ada", "unknown"])
```

### `hasAll`

Returns `true` when every provided key exists.

```ts
hasAll(keys: Iterable<TKey>): boolean
```

```ts
users.hasAll(["ada", "grace"])
```

### `search`

Returns the key of the first value equal to the supplied value, or the first value matching a predicate.

```ts
search(valueOrPredicate): TKey | undefined
```

```ts
collect(new Map([["a", 10], ["b", 20]])).search(20) // "b"
```

### `first`

Returns the first value, or the first value matching an optional predicate.

```ts
first(predicate?): TValue | undefined
```

```ts
collect([10, 20, 30]).first((value) => value > 10) // 20
```

### `firstOrFail`

Returns the first matching value and throws `CollectionItemNotFoundError` if no value matches.

```ts
firstOrFail(predicate?): TValue
```

```ts
users.firstOrFail((user) => user.enabled)
```

### `last`

Returns the last value, or the last value matching an optional predicate.

```ts
last(predicate?): TValue | undefined
```

```ts
collect([10, 20, 30]).last() // 30
```

### `lastOrFail`

Returns the last matching value and throws when no value matches.

```ts
lastOrFail(predicate?): TValue
```

```ts
users.lastOrFail((user) => user.enabled)
```

### `sole`

Returns the only matching value. Throws when zero or multiple values match.

```ts
sole(predicate?): TValue
```

```ts
users.sole((user) => user.email === "ada@example.com")
```

### `nth`

Returns every nth entry while preserving the original keys. `step` must be a positive integer.

```ts
nth(step: number, offset?: number): Collection<TKey, TValue>
```

```ts
collect([0, 1, 2, 3, 4]).nth(2).items() // [0, 2, 4]
```

### `random`

Returns one random value, or a numerically keyed collection containing up to `count` random values.

```ts
random(): TValue | undefined
random(count: number): Collection<number, TValue>
```

```ts
const one = users.random()
const three = users.random(3)
```

## Transformation

### `map`

Transforms every value while preserving the current keys.

```ts
map<TMapped>(callback): Collection<TKey, TMapped>
```

```ts
collect([1, 2, 3]).map((value) => value * 2).items() // [2, 4, 6]
```

### `mapValues`

Semantic alias for `map()` when emphasizing that only values change.

```ts
mapValues<TMapped>(callback): Collection<TKey, TMapped>
```

```ts
users.mapValues((user) => user.name)
```

### `mapKeys`

Transforms each key while keeping its value.

```ts
mapKeys<TMappedKey>(callback): Collection<TMappedKey, TValue>
```

```ts
users.mapKeys((user) => user.email)
```

### `mapWithKeys`

Transforms every entry into a new key/value tuple.

```ts
mapWithKeys<TMappedKey, TMappedValue>(callback): Collection<TMappedKey, TMappedValue>
```

```ts
users.mapWithKeys((user) => [user.email, user.name])
```

### `flatMap`

Maps each item to an iterable and flattens one layer into numeric keys.

```ts
flatMap<TMapped>(callback): Collection<number, TMapped>
```

```ts
collect([1, 2]).flatMap((value) => [value, value * 10]).items() // [1, 10, 2, 20]
```

### `flatten`

Recursively flattens iterable values. Strings are treated as terminal values. The default depth is unlimited.

```ts
flatten(depth?: number): Collection<number, unknown>
```

```ts
collect([[[1]], [[2, 3]]]).flatten().items() // [1, 2, 3]
```

### `collapse`

Flattens exactly one iterable layer and infers the nested item type.

```ts
collapse(): Collection<number, FlattenValue<TValue>>
```

```ts
collect([[1, 2], [3]]).collapse().items() // [1, 2, 3]
```

### `pluck`

Extracts a strongly typed nested path from every value while preserving keys.

```ts
pluck(path): Collection<TKey, CollectionPathValue<...>>
```

```ts
users.pluck("profile.email")
```

### `keyBy`

Re-keys values using a typed nested path or callback. Later duplicate keys replace earlier values.

```ts
keyBy(pathOrCallback): Collection<TMappedKey, TValue>
```

```ts
users.keyBy("profile.email")
```

## Filtering

### `filter`

Keeps values accepted by a predicate. Type-guard predicates narrow the resulting collection value type.

```ts
filter(predicate): Collection<TKey, TValue>
```

```ts
collect([1, null, 2]).filter((value): value is number => value !== null)
```

### `reject`

Removes values for which the predicate returns `true`.

```ts
reject(predicate): Collection<TKey, TValue>
```

```ts
users.reject((user) => user.disabled)
```

### `where`

Keeps items whose nested path strictly equals an expected value using `Object.is`.

```ts
where(path, expected): Collection<TKey, TValue>
```

```ts
users.where("role", "admin")
```

### `whereNot`

Keeps items whose nested path does not strictly equal an expected value.

```ts
whereNot(path, expected): Collection<TKey, TValue>
```

```ts
users.whereNot("role", "guest")
```

### `whereIn`

Keeps items whose nested path is contained by the supplied iterable.

```ts
whereIn(path, values): Collection<TKey, TValue>
```

```ts
users.whereIn("role", ["admin", "member"])
```

### `whereNotIn`

Keeps items whose nested path is not contained by the supplied iterable.

```ts
whereNotIn(path, values): Collection<TKey, TValue>
```

```ts
users.whereNotIn("role", ["blocked"])
```

### `whereNull`

Keeps items whose nested path resolves to `null` or `undefined`.

```ts
whereNull(path): Collection<TKey, TValue>
```

```ts
users.whereNull("profile.avatar")
```

### `whereNotNull`

Keeps items whose nested path resolves to a non-nullish value.

```ts
whereNotNull(path): Collection<TKey, TValue>
```

```ts
users.whereNotNull("profile.avatar")
```

## Predicates

### `contains`

Determines whether the collection contains a value using `Object.is`, or whether a predicate matches any item.

```ts
contains(valueOrPredicate): boolean
```

```ts
numbers.contains(10)
users.contains((user) => user.enabled)
```

### `doesntContain`

Inverse of `contains()`.

```ts
doesntContain(valueOrPredicate): boolean
```

```ts
users.doesntContain((user) => user.blocked)
```

### `every`

Returns `true` when every item satisfies a predicate. Empty collections return `true`.

```ts
every(predicate): boolean
```

```ts
numbers.every((value) => value > 0)
```

### `some`

Returns `true` when at least one item satisfies a predicate.

```ts
some(predicate): boolean
```

```ts
users.some((user) => user.enabled)
```


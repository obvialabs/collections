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

## Subsets & Windows

### `only`

Keeps entries whose keys appear in the supplied iterable.

```ts
only(keys: Iterable<TKey>): Collection<TKey, TValue>
```

```ts
users.only(["ada", "grace"])
```

### `except`

Removes entries whose keys appear in the supplied iterable.

```ts
except(keys: Iterable<TKey>): Collection<TKey, TValue>
```

```ts
users.except(["blocked"])
```

### `take`

Takes items from the start when positive or from the end when negative.

```ts
take(limit: number): Collection<TKey, TValue>
```

```ts
collect([1, 2, 3, 4]).take(-2).items() // [3, 4]
```

### `skip`

Skips items from the start when positive or from the end when negative.

```ts
skip(count: number): Collection<TKey, TValue>
```

```ts
collect([1, 2, 3, 4]).skip(2).items() // [3, 4]
```

### `slice`

Returns a native-style slice while preserving entry keys.

```ts
slice(offset: number, length?: number): Collection<TKey, TValue>
```

```ts
collect([1, 2, 3, 4]).slice(1, 2).items() // [2, 3]
```

### `takeUntil`

Takes values until a predicate matches. The matching value is excluded.

```ts
takeUntil(predicate): Collection<TKey, TValue>
```

```ts
collect([1, 2, 3, 4]).takeUntil((value) => value === 3).items() // [1, 2]
```

### `takeWhile`

Takes values while a predicate remains true.

```ts
takeWhile(predicate): Collection<TKey, TValue>
```

```ts
collect([1, 2, 3, 4]).takeWhile((value) => value < 3).items() // [1, 2]
```

### `skipUntil`

Skips values until a predicate matches and includes the matching item.

```ts
skipUntil(predicate): Collection<TKey, TValue>
```

```ts
collect([1, 2, 3, 4]).skipUntil((value) => value === 3).items() // [3, 4]
```

### `skipWhile`

Skips values while a predicate remains true.

```ts
skipWhile(predicate): Collection<TKey, TValue>
```

```ts
collect([1, 2, 3, 4]).skipWhile((value) => value < 3).items() // [3, 4]
```

### `chunk`

Splits entries into fixed-size nested collections. `size` must be a positive integer.

```ts
chunk(size: number): Collection<number, Collection<TKey, TValue>>
```

```ts
collect([1, 2, 3, 4, 5]).chunk(2).map((chunk) => chunk.items()).items()
```

### `sliding`

Creates overlapping fixed-size windows with a configurable positive step.

```ts
sliding(size: number, step?: number): Collection<number, Collection<TKey, TValue>>
```

```ts
collect([1, 2, 3, 4]).sliding(2).map((window) => window.items()).items()
```

### `split`

Splits the collection into approximately equal groups.

```ts
split(groups: number): Collection<number, Collection<TKey, TValue>>
```

```ts
collect([1, 2, 3, 4, 5]).split(2)
```

### `pad`

Pads values to an absolute target size. Positive sizes append; negative sizes prepend.

```ts
pad<TPad>(size: number, value: TPad): Collection<number, TValue | TPad>
```

```ts
collect([1, 2]).pad(4, 0).items() // [1, 2, 0, 0]
```

### `partition`

Splits items into matching and rejected collections.

```ts
partition(predicate): readonly [Collection<TKey, TValue>, Collection<TKey, TValue>]
```

```ts
const [enabled, disabled] = users.partition((user) => user.enabled)
```

## Ordering

### `reverse`

Reverses iteration order while preserving keys.

```ts
reverse(): Collection<TKey, TValue>
```

```ts
collect([1, 2, 3]).reverse().items() // [3, 2, 1]
```

### `shuffle`

Returns a new collection with randomized entry order.

```ts
shuffle(): Collection<TKey, TValue>
```

```ts
const randomized = users.shuffle()
```

### `sort`

Sorts entries using a comparator that receives both values and keys.

```ts
sort(comparator): Collection<TKey, TValue>
```

```ts
users.sort((left, right) => left.age - right.age)
```

### `sortBy`

Sorts ascending using a typed nested path or callback result.

```ts
sortBy(pathOrCallback): Collection<TKey, TValue>
```

```ts
users.sortBy("profile.score")
```

### `sortByDesc`

Sorts descending using a typed nested path or callback result.

```ts
sortByDesc(pathOrCallback): Collection<TKey, TValue>
```

```ts
users.sortByDesc("profile.score")
```

### `sortKeys`

Sorts entries by key in ascending deterministic order.

```ts
sortKeys(): Collection<TKey, TValue>
```

```ts
roles.sortKeys()
```

### `sortKeysDesc`

Sorts entries by key in descending deterministic order.

```ts
sortKeysDesc(): Collection<TKey, TValue>
```

```ts
roles.sortKeysDesc()
```

## Grouping

### `groupBy`

Groups values into nested collections using a typed path or callback result.

```ts
groupBy(pathOrCallback): Collection<TGroupKey, Collection<TKey, TValue>>
```

```ts
const byRole = users.groupBy("role")
```

### `countBy`

Counts values by a typed path or callback result.

```ts
countBy(pathOrCallback): Collection<TGroupKey, number>
```

```ts
users.countBy("role").get("member")
```

## Set Operations

### `unique`

Keeps the first item for each unique selected value.

```ts
unique(selector?): Collection<TKey, TValue>
```

```ts
users.unique((user) => user.email)
```

### `duplicates`

Keeps items whose selected value has already appeared earlier in iteration order.

```ts
duplicates(selector?): Collection<TKey, TValue>
```

```ts
users.duplicates((user) => user.email)
```

### `diff`

Keeps values not present in another iterable.

```ts
diff(values: Iterable<TValue>): Collection<TKey, TValue>
```

```ts
collect([1, 2, 3]).diff([2, 4]).items() // [1, 3]
```

### `intersect`

Keeps values also present in another iterable.

```ts
intersect(values: Iterable<TValue>): Collection<TKey, TValue>
```

```ts
collect([1, 2, 3]).intersect([2, 4]).items() // [2]
```

### `diffKeys`

Keeps entries whose keys are absent from another key iterable.

```ts
diffKeys(keys: Iterable<TKey>): Collection<TKey, TValue>
```

```ts
users.diffKeys(["blocked"])
```

### `intersectByKeys`

Keeps entries whose keys are present in another key iterable.

```ts
intersectByKeys(keys: Iterable<TKey>): Collection<TKey, TValue>
```

```ts
users.intersectByKeys(["ada", "grace"])
```

### `union`

Adds entries whose keys do not already exist. Existing entries win.

```ts
union(entries: Iterable<readonly [TKey, TValue]>): Collection<TKey, TValue>
```

```ts
settings.union([["theme", "dark"]])
```

## Immutable Updates

### `merge`

Merges entries into a new collection. Incoming values replace entries with matching keys.

```ts
merge<TMergeKey, TMergeValue>(entries): Collection<TKey | TMergeKey, TValue | TMergeValue>
```

```ts
settings.merge([["theme", "dark"], ["density", "compact"]])
```

### `replace`

Replaces values only for keys that already exist in the collection.

```ts
replace(entries: Iterable<readonly [TKey, TValue]>): Collection<TKey, TValue>
```

```ts
settings.replace([["theme", "dark"]])
```

### `with`

Returns a new collection with one key/value pair inserted or replaced.

```ts
with<TNewKey, TNewValue>(key, value): Collection<TKey | TNewKey, TValue | TNewValue>
```

```ts
const next = settings.with("theme", "dark")
```

### `append`

Appends a value using the next numeric key. Existing numeric keys are inspected to choose the next index.

```ts
append<TAppend>(value): Collection<TKey | number, TValue | TAppend>
```

```ts
collect([1, 2]).append(3).items() // [1, 2, 3]
```

### `prepend`

Prepends a value and returns a numerically re-keyed collection.

```ts
prepend<TPrepend>(value): Collection<number, TValue | TPrepend>
```

```ts
collect([2, 3]).prepend(1).items() // [1, 2, 3]
```

### `remove`

Returns a new collection without the supplied key.

```ts
remove(key: TKey): Collection<TKey, TValue>
```

```ts
const next = users.remove("blocked")
```

## Combining

### `zip`

Combines values by position. Missing positions are represented by `undefined`.

```ts
zip<TOther>(values): Collection<number, readonly [TValue | undefined, TOther | undefined]>
```

```ts
collect([1, 2]).zip(["a"]).items() // [[1, "a"], [2, undefined]]
```

### `crossJoin`

Returns the Cartesian product of collection values and another iterable.

```ts
crossJoin<TOther>(values): Collection<number, readonly [TValue, TOther]>
```

```ts
collect([1, 2]).crossJoin(["a", "b"]).items()
```

## Reduction & Flow

### `reduce`

Reduces entries into a native accumulated result.

```ts
reduce<TResult>(callback, initial): TResult
```

```ts
const total = collect([1, 2, 3]).reduce((sum, value) => sum + value, 0)
```

### `each`

Executes a callback for each entry and returns the same collection. Returning `false` stops iteration early.

```ts
each(callback): this
```

```ts
users.each((user) => { console.log(user) })
```

### `tap`

Runs a side-effect callback with the collection and returns the same instance.

```ts
tap(callback): this
```

```ts
users.tap((collection) => console.log(collection.count())).filter((user) => user.enabled)
```

### `pipe`

Passes the collection to a callback and returns the callback result.

```ts
pipe<TResult>(callback): TResult
```

```ts
const count = users.pipe((collection) => collection.count())
```

### `when`

Runs a collection transformation when a condition is true; otherwise returns the current collection.

```ts
when(condition, callback): Collection<TKey, TValue>
```

```ts
users.when(includeDisabled, (items) => items.where("disabled", true))
```

### `unless`

Runs a collection transformation when a condition is false.

```ts
unless(condition, callback): Collection<TKey, TValue>
```

```ts
users.unless(includeDisabled, (items) => items.whereNot("disabled", true))
```

## Aggregates

### `sum`

Sums numeric values selected by an optional callback.

```ts
sum(selector?): number
```

```ts
orders.sum((order) => order.total)
```

### `avg`

Alias for `average()`.

```ts
avg(selector?): number | undefined
```

```ts
orders.avg((order) => order.total)
```

### `average`

Returns the arithmetic average of selected numeric values, or `undefined` for an empty collection.

```ts
average(selector?): number | undefined
```

```ts
orders.average((order) => order.total)
```

### `min`

Returns the minimum selected value using deterministic scalar comparison.

```ts
min(selector?): TComparable | undefined
```

```ts
users.min((user) => user.age)
```

### `max`

Returns the maximum selected value using deterministic scalar comparison.

```ts
max(selector?): TComparable | undefined
```

```ts
users.max((user) => user.age)
```

### `median`

Returns the median selected numeric value, or `undefined` for an empty collection.

```ts
median(selector?): number | undefined
```

```ts
orders.median((order) => order.total)
```

### `mode`

Returns every selected value tied for the highest frequency.

```ts
mode(selector?): readonly TMode[]
```

```ts
collect([1, 2, 2, 3, 3]).mode() // [2, 3]
```

## Strings

### `join`

Converts values to strings and joins them. An optional final glue can be used before the last item.

```ts
join(glue: string, finalGlue?: string): string
```

```ts
collect(["Ada", "Grace", "Linus"]).join(", ", " and ")
```

### `implode`

Extracts a nested path, converts each result to string and joins with the supplied glue.

```ts
implode(path, glue: string): string
```

```ts
users.implode("profile.email", ", ")
```

## Iteration

### `[Symbol.iterator]`

Returns the underlying key/value entry iterator. This makes collections compatible with `for...of` and spread syntax.

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

## Example: Typed UI Slides

```ts
import { createCollection } from "@obvia/collections"

export const slides = createCollection({
    canvas: {
        eyebrow: "Visual workspace",
        title: "Design at the speed of thought.",
        stats: [
            { value: "∞", label: "Canvas" },
            { value: "1", label: "Workbench" },
        ],
    },
    collaboration: {
        eyebrow: "Shared context",
        title: "Keep product decisions connected.",
        stats: [
            { value: "Live", label: "Presence" },
            { value: "1×", label: "Source of truth" },
        ],
    },
})

export type Slide = ReturnType<typeof slides.items>[number]
export type SlideId = ReturnType<typeof slides.keys>[number]

slides.canvas.id // "canvas"
slides.items().map((slide) => slide.title)
slides.count() // 2
```

## Package Exports

The complete API is available from the package root.

```ts
import {
    Collection,
    CollectionItemNotFoundError,
    CollectionMultipleItemsError,
    collect,
    createCollection,
} from "@obvia/collections"
```

Focused subpath exports are also available.

```ts
import { Collection } from "@obvia/collections/collection"
import { collect } from "@obvia/collections/collect"
import { createCollection } from "@obvia/collections/create-collection"
```

## Development

Install dependencies with Bun:

```bash
bun install
```

Type-check the source:

```bash
bun run typecheck
```

Build ESM JavaScript and declaration files:

```bash
bun run build
```

### Test strategy

The test suite is intentionally split by responsibility instead of relying on unit tests alone:

- `tests/unit` verifies individual collection operations and their return values.
- `tests/behavior` protects immutability, direct-access definitions, package exports and the public API surface.
- `tests/guards` verifies failure behavior and rejects invalid arguments instead of accepting silent coercion.
- `tests/properties` compares generated inputs against equivalent native Array/Map behavior and checks collection invariants.
- `tests/types.test.ts` is compiled separately to lock literal inference, nested paths, narrowing and expected TypeScript failures.

Run the complete runtime suite with Bun:

```bash
bun run test:runtime
```

Run an individual layer while developing:

```bash
bun run test:unit
bun run test:behavior
bun run test:guards
bun run test:properties
bun run test:types
```

Generate Bun's runtime coverage report:

```bash
bun run test:coverage
```

Run every test layer:

```bash
bun run test
```

Run the complete release check:

```bash
bun run check
```

### Benchmarks

Benchmarks are deliberately separate from correctness tests. They report timing data without turning machine-dependent performance into flaky pass/fail assertions.

```bash
bun run benchmark
```

The default benchmark uses 25,000 items, 3 warmups and 15 measured samples. Override those values when profiling larger workloads:

```bash
COLLECTION_BENCH_SIZE=100000 \
COLLECTION_BENCH_SAMPLES=30 \
COLLECTION_BENCH_WARMUPS=5 \
bun run benchmark
```

The benchmark includes native Array context plus collection construction, mapping/filtering, grouping, sorting, a fluent pipeline and defined-collection direct access. Treat the output as a regression/profiling aid rather than a universal performance score.

Inspect the files that will be published:

```bash
npm pack --dry-run
```

## Publishing

The package publishes only `dist`, `README.md`, `CHANGELOG.md` and `LICENSE` in addition to npm-managed package metadata. The package is public-scoped and declares no runtime dependencies.

A publish runs the complete verification suite through `prepublishOnly`:

```bash
npm publish --access public
```

## License

MIT

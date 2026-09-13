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

The package exposes two creation functions because they solve two different problems:

- `collect()` wraps **runtime data** such as arrays, maps, objects and entry iterables.
- `createCollection()` declares a **static keyed definition** whose object keys become literal item IDs and safe keys become direct properties.

```ts
import { collect, createCollection } from "@obvia/collections"

// Runtime data: numeric keys come from the array indexes.
const numbers = collect([1, 2, 3, 4, 5])

const result = numbers
    .filter((value) => value % 2 !== 0)
    .map((value) => value * 10)
    .take(2)

result.items() // [10, 30]
result.keys()  // [0, 2] - filter/map preserved the original keys

// Static keyed definition: object keys become canonical literal IDs.
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
slides.get("security")?.id // "security"
slides.count() // 2
slides.keys() // ["canvas", "security"]
```

Both return the same runtime `Collection` abstraction and therefore share the same fluent API. `createCollection()` adds a typed definition layer only at the root instance.

## `collect()` vs `createCollection()`

This distinction is intentional and is the most important creation decision in the package.

| | `collect()` | `createCollection()` |
| --- | --- | --- |
| Primary purpose | Wrap runtime data | Declare a keyed registry/definition |
| Typical input | Array, `Map`, object, iterable | Object whose values are definition objects |
| Item `id` injection | No | Yes, from the object key |
| Literal per-item `get()` typing | General key/value type | Exact item type for each known key |
| Direct `collection.someKey` access | No | Yes, when the key does not collide with the runtime API |
| Primitive values | Yes | No; definition items are objects |
| Dynamic data from an API/database | Preferred | Usually not appropriate |
| Static providers/routes/slides/commands | Works, but less expressive | Preferred |
| Fluent transformations | `Collection` | Root is `DefinedCollection`; transformed results are regular `Collection`s |

A practical decision rule:

1. **Did the data arrive at runtime?** Use `collect()`. API responses, database rows, configuration loaded from disk, arrays assembled by user input and maps produced by application logic are runtime data.
2. **Are you declaring a finite set of named definitions in source code?** Use `createCollection()`. Providers, commands, routes, showcase slides and tool registries are typical examples.
3. **Do you want the object key to become the item's canonical typed `id`?** That is specifically `createCollection()`. `collect()` never rewrites your values.
4. **Do you want `registry.google`-style direct access?** That direct definition surface exists only on the root returned by `createCollection()`.

The same JavaScript object can technically be accepted by either function, but the meaning is different:

```ts
const source = {
    google: { label: "Google" },
    github: { label: "GitHub" },
}

const runtime = collect(source)
runtime.get("google")
// { label: "Google" }
// No injected id and no runtime.google direct property.

const registry = createCollection(source)
registry.google
// { id: "google", label: "Google" }

registry.get("google")?.id
// "google"
```

So the distinction is not "object versus array." It is **runtime data versus source-defined keyed definitions**.

### Choose `collect()` for runtime values

Use `collect()` when the data already exists and the collection is a processing/query abstraction around it.

```ts
const users = collect(await api.users.list())

const activeEmails = users
    .filter((user) => user.active)
    .sortBy("profile.name")
    .pluck("profile.email")
    .values()
```

Arrays receive numeric indexes as keys. Maps and entry iterables preserve their keys. Plain objects preserve enumerable own string keys.

```ts
const array = collect(["a", "b"])
array.entries() // [[0, "a"], [1, "b"]]

const map = collect(new Map([
    ["admin", { level: 10 }],
    ["member", { level: 1 }],
]))
map.keys() // ["admin", "member"]

const object = collect({
    draft: true,
    published: false,
})
object.keys() // ["draft", "published"]
```

Passing an existing `Collection` is intentionally a no-op:

```ts
const first = collect([1, 2, 3])
const second = collect(first)

first === second // true
```

### Choose `createCollection()` for definitions

Use `createCollection()` when the keys themselves are part of the domain model and should become typed item IDs.

```ts
const providers = createCollection({
    google: {
        label: "Google",
        enabled: true,
    },
    github: {
        label: "GitHub",
        enabled: true,
    },
    enterprise: {
        label: "Enterprise SSO",
        enabled: false,
    },
})

providers.google.id // "google"
providers.github.label // "GitHub"
providers.get("enterprise")?.enabled // false
```

The key is the canonical identity. If an item supplies an `id`, it is replaced:

```ts
const routes = createCollection({
    home: {
        id: "incorrect",
        path: "/",
    },
})

routes.home.id // "home"
```

This is useful for registries where repeating the key inside the value would otherwise create two sources of truth.

### Direct access exists only on the definition root

The direct properties added by `createCollection()` describe the original definition. Fluent methods return ordinary `Collection` instances because filtering, re-keying or mapping can invalidate the static direct-property surface.

```ts
const slides = createCollection({
    canvas: { enabled: true },
    security: { enabled: false },
})

slides.canvas // direct root access

const enabled = slides.filter((slide) => slide.enabled)

enabled.get("canvas") // works
enabled.items()       // works
// enabled.canvas     // TypeScript error; this is now a regular Collection
```

That behavior is deliberate: direct properties never pretend that a transformed collection still contains every definition key.

### Method-name collisions stay safe

A definition may contain IDs such as `map`, `filter`, `count`, `constructor` or `toString`. Those keys are never installed as direct properties because doing so would shadow the collection API or inherited object members.

```ts
const definitions = createCollection({
    security: { label: "Security" },
    map: { label: "Map item" },
    constructor: { label: "Constructor item" },
})

definitions.security.label // "Security"
definitions.get("map")?.label // "Map item"
definitions.get("constructor")?.label // "Constructor item"

definitions.map((item) => item.label) // still Collection#map
```

## Design

- **Immutable membership:** collection-producing operations create new collection instances rather than changing the source membership or order.
- **Shallow by design:** values are not deep-cloned. If a stored object is mutated elsewhere, the collection still points at that object.
- **Fluent:** collection-producing methods can be chained without dropping into native arrays between operations.
- **Key-aware:** operations preserve keys whenever their semantics do not explicitly re-key the data.
- **Deeply typed:** nested dot paths such as `"profile.email"` are inferred and validated by TypeScript.
- **Definition-friendly:** `createCollection()` turns object keys into literal item IDs without repeating `id` fields.
- **Collision-safe:** definition keys that overlap runtime methods remain accessible through `get()` instead of replacing methods.
- **Iterable:** every collection implements `Iterable<[TKey, TValue]>` and works with `for...of`, spread syntax and `new Map(collection)`.
- **Runtime-neutral output:** the published package has no runtime dependencies and emits standard ESM JavaScript.
- **Explicit extraction:** native arrays/maps/objects are produced only by explicit conversion methods such as `items()`, `toArray()`, `toMap()` and `toObject()`.

## Behavioral Guarantees

These rules apply throughout the API and are useful when reading the method reference.

### Immutability is about collection structure

Operations do not mutate the source collection:

```ts
const source = collect(new Map([
    ["a", 3],
    ["b", 1],
    ["c", 2],
]))

const sorted = source.sort((left, right) => left - right)

source.keys() // ["a", "b", "c"]
sorted.keys() // ["b", "c", "a"]
```

Values themselves are deliberately not deep-frozen or deep-cloned:

```ts
const user = { profile: { active: true } }
const users = collect([user])

user.profile.active = false
users.first()?.profile.active // false
```

`createCollection()` copies each item object once so later top-level changes to the definition object do not rewrite the stored item, but nested references remain shared.

### Key preservation is method-specific

Most filtering and value transformations preserve keys:

```ts
const values = collect(new Map([
    ["a", 10],
    ["b", 20],
    ["c", 30],
]))

values.filter((value) => value >= 20).keys() // ["b", "c"]
values.map((value) => value * 2).keys()      // ["a", "b", "c"]
```

Methods whose meaning requires a new sequence intentionally use numeric keys, including `flatMap`, `flatten`, `collapse`, `values`, `prepend`, `pad`, `zip`, `crossJoin` and `random(count)`.

Methods that explicitly derive keys include `mapKeys`, `mapWithKeys` and `keyBy`.

### Equality semantics are explicit

- `search(value)`, `contains(value)`, `where()` and `whereNot()` use `Object.is` semantics. This means `NaN` matches `NaN`, while `0` and `-0` are distinct.
- Membership/set methods backed by `Set` (`whereIn`, `whereNotIn`, `unique`, `duplicates`, `diff`, `intersect`) use JavaScript SameValueZero semantics. This means `NaN` matches `NaN` and `0`/`-0` are treated as the same set value.
- Keys use native `Map` identity semantics.

### Ordering is stable

Collection order is insertion order unless an ordering operation changes it. Sort operations use JavaScript's stable sort behavior, so entries that compare equally keep their relative order.

The built-in scalar comparator used by `sortBy`, `sortByDesc`, `sortKeys`, `sortKeysDesc`, `min` and `max` follows these rules:

1. `null`
2. `undefined`
3. non-nullish values
4. numbers numerically, with `NaN` after real numbers in ascending order
5. bigints numerically
6. dates by timestamp
7. other values by string comparison

Descending order reverses that comparator while still keeping equal values stable.

### Duplicate derived keys follow `Map` semantics

Re-keying can collapse entries. If two values resolve to the same key, the later value replaces the earlier value while the key keeps its original insertion position.

```ts
collect([
    { id: 1, email: "same@example.com" },
    { id: 2, email: "other@example.com" },
    { id: 3, email: "same@example.com" },
]).keyBy("email").items()
// [
//   { id: 3, email: "same@example.com" },
//   { id: 2, email: "other@example.com" },
// ]
```

`union()` is intentionally different: existing keys win, and the first incoming value for a previously absent key wins. `merge()` overwrites, so the last incoming duplicate wins.

### Callback signatures are consistent

Where useful, callbacks receive values and keys in collection order. Transform/filter callbacks that expose the collection pass the original source instance as the third argument.

```ts
collection.map((value, key, source) => {
    // value  -> TValue
    // key    -> TKey
    // source -> the collection on which map() was called
})
```

Short-circuiting methods stop invoking callbacks as soon as their result is known: `search`, `first`, `some`, `every`, `takeUntil`, `takeWhile`, `skipUntil`, `skipWhile`, `hasAny` and `hasAll`.

### Empty collections have predictable identities

- `count()` -> `0`
- `empty()` -> `true`
- `notEmpty()` -> `false`
- `first()`, `last()`, `random()`, `average()`, `avg()`, `median()`, `min()`, `max()` -> `undefined`
- `mode()` -> `[]`
- `sum()` -> `0`
- `every()` -> `true`
- `some()` -> `false`
- collection-producing methods return an empty collection unless their operation adds values
- `firstOrFail()`, `lastOrFail()` and `sole()` throw when a required item does not exist

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

## API Reference Conventions

Unless a method says otherwise:

- a returned `Collection` is a **new instance**;
- the source collection's membership and order are unchanged;
- preserved keys keep their original identity and iteration order;
- callbacks run in collection iteration order;
- collection values are passed by reference, not cloned;
- examples show observable behavior rather than implementation details.

The method reference below calls out the exceptions: re-indexing, re-keying, short-circuit behavior, throwing behavior and special empty-collection results.

## Method Behavior Matrix

This table is the compact behavioral contract for the complete runtime API. The detailed sections that follow include signatures and examples.

### State, extraction and access

| Method | Return / keys | Important behavior |
| --- | --- | --- |
| `count()` | `number` | Number of stored key/value entries. |
| `empty()` | `boolean` | `true` only when `count() === 0`. |
| `notEmpty()` | `boolean` | Exact inverse of `empty()`. |
| `items()` | readonly array | Fresh array snapshot of values in iteration order. |
| `all()` | readonly array | Alias of `items()`. |
| `keys()` | readonly array | Fresh array snapshot of keys in iteration order. |
| `entries()` | readonly tuple array | Fresh entry-container snapshot; values remain shallow references. |
| `toArray()` | mutable array | Native mutable copy of values; mutating it cannot change collection membership. |
| `toMap()` | `ReadonlyMap` | Defensive `Map` copy. |
| `toObject()` | null-prototype object | Accepts only string/number/symbol runtime keys; rejects other key types instead of coercing them. |
| `get(key)` | value or `undefined` | Cannot by itself distinguish missing from a present `undefined`; pair with `has()` when needed. |
| `getOr(key, fallback)` | value | Fallback runs only when the key is absent, never for a present `undefined` value. |
| `has(key)` | `boolean` | Native `Map` key identity semantics. |
| `hasAny(keys)` | `boolean` | Short-circuits on first existing key; empty key iterable => `false`. |
| `hasAll(keys)` | `boolean` | Short-circuits on first missing key; empty key iterable => `true`. |
| `search(value)` | key or `undefined` | First `Object.is` value match. |
| `search(predicate)` | key or `undefined` | First predicate match; short-circuits. |
| `first(predicate?)` | value or `undefined` | First entry, or first match. |
| `firstOrFail(predicate?)` | value | Same selection as `first`; throws `CollectionItemNotFoundError` when absent. |
| `last(predicate?)` | value or `undefined` | Last matching entry; predicate necessarily scans the whole collection. |
| `lastOrFail(predicate?)` | value | Throws when no match exists. |
| `sole(predicate?)` | value | Requires exactly one match; throws on zero or the moment a second match is found. |
| `nth(step, offset)` | preserves keys | Selects indexes `offset`, `offset + step`, ...; step > 0, offset >= 0. |
| `random()` | value or `undefined` | Empty collection => `undefined`. |
| `random(count)` | numeric keys | Unique sampled entries, reindexed from zero; count may not exceed collection size; `random(0)` performs no shuffle/RNG work. |
| `values()` | numeric keys | Same values, always reindexed `0..n-1`. |

### Transformation and filtering

| Method | Key behavior | Important behavior |
| --- | --- | --- |
| `map()` | preserves keys | Callback receives `(value, key, source)` exactly once per entry. |
| `mapValues()` | preserves keys | Alias-style value mapping with the same callback contract as `map()`. |
| `mapKeys()` | replaces keys | Duplicate derived keys collapse using `Map` replacement semantics. |
| `mapWithKeys()` | replaces keys and values | Callback returns a `[key, value]` tuple. |
| `flatMap()` | numeric keys | Maps each entry to an iterable, concatenates one level, then reindexes. |
| `flatten(depth)` | numeric keys | Flattens iterable values recursively to `depth`; strings are atomic. |
| `collapse()` | numeric keys | `flatten(1)` with inferred one-layer value type. |
| `pluck(path)` | preserves keys | Reads a typed nested path from every value. |
| `keyBy(path/callback)` | replaces keys | Later duplicate keys replace earlier values while keeping first key position. |
| `filter()` | preserves keys | Keeps predicate matches; supports TypeScript type guards. |
| `reject()` | preserves keys | Exact logical complement of `filter(predicate)`. |
| `where()` | preserves keys | Nested-path equality uses `Object.is`. |
| `whereNot()` | preserves keys | Inverse of `where()`. |
| `whereIn()` | preserves keys | Membership uses `Set` / SameValueZero semantics. |
| `whereNotIn()` | preserves keys | Inverse set membership. |
| `whereNull()` | preserves keys | Matches only `null` and `undefined`. |
| `whereNotNull()` | preserves keys | Excludes only `null` and `undefined`. |
| `contains(value)` | `boolean` | Uses `Object.is`; function arguments are interpreted as predicates. |
| `contains(predicate)` | `boolean` | Short-circuits on first match. |
| `doesntContain()` | `boolean` | Logical inverse of `contains()`. |
| `every()` | `boolean` | Short-circuits on first failure; empty collection => `true`. |
| `some()` | `boolean` | Short-circuits on first match; empty collection => `false`. |

### Subsets, windows and ordering

| Method | Key behavior | Important behavior |
| --- | --- | --- |
| `only(keys)` | preserves keys | Result follows source order, not requested-key order. |
| `except(keys)` | preserves keys | Unknown keys are ignored. |
| `take(n)` | preserves keys | Positive => first `n`; negative => last `abs(n)`; zero => empty. |
| `skip(n)` | preserves keys | Positive skips from front; negative skips from end. |
| `slice(offset, length?)` | preserves keys | Negative offset counts from end; second argument is a length, not an end index. |
| `takeUntil()` | preserves keys | Stops before first matching entry; matching entry excluded. |
| `takeWhile()` | preserves keys | Stops at first predicate failure. |
| `skipUntil()` | preserves keys | Starts at first match; matching entry included. |
| `skipWhile()` | preserves keys | Starts at first predicate failure. |
| `chunk(size)` | outer numeric keys | Fixed-size nested collections; original keys preserved inside chunks. |
| `sliding(size, step)` | outer numeric keys | Emits complete windows only. |
| `split(groups)` | outer numeric keys | Balanced groups; earlier groups receive remainder items; never emits empty groups. |
| `pad(size, value)` | numeric keys | Positive pads right, negative pads left; always reindexes even when no padding is needed. |
| `partition()` | two collections, preserved keys | Returns `[accepted, rejected]`, both preserving source order. |
| `reverse()` | preserves keys | Reverses entry order only. |
| `shuffle()` | preserves keys | Randomizes entry order while keeping every key attached to its value. |
| `sort(comparator)` | preserves keys | Stable sort; comparator receives both values and both keys. |
| `sortBy(path/callback)` | preserves keys | Stable ascending scalar comparison; a callback selector is resolved exactly once per source entry. |
| `sortByDesc(path/callback)` | preserves keys | Stable descending scalar comparison; a callback selector is resolved exactly once per source entry. |
| `sortKeys()` | preserves key/value pairs | Orders by built-in scalar key comparator. |
| `sortKeysDesc()` | preserves key/value pairs | Descending key order. |

### Grouping, sets and immutable updates

| Method | Key behavior | Important behavior |
| --- | --- | --- |
| `groupBy(path/callback)` | derived outer keys | First-seen group order; each nested group preserves original keys. |
| `countBy(path/callback)` | derived keys | One selector evaluation per source entry. |
| `unique(selector?)` | preserves keys | Keeps first entry for each SameValueZero selector result. |
| `duplicates(selector?)` | preserves keys | Returns every repeated occurrence after the first. |
| `diff(values)` | preserves keys | Keeps values absent from the comparison set. |
| `intersect(values)` | preserves keys | Keeps values present in the comparison set. |
| `diffKeys(keys)` | preserves keys | Compares keys only. |
| `intersectByKeys(keys)` | preserves keys | Compares keys only. |
| `union(entries)` | preserves existing order | Existing keys win; first incoming value wins for a new duplicate key. |
| `merge(entries)` | preserves/reuses key positions | Incoming values overwrite; later incoming duplicates win. |
| `replace(entries)` | preserves keys | Updates existing keys only; never adds unknown keys. |
| `with(key, value)` | preserves/reuses key position | Replaces existing key or appends a new key. |
| `append(value)` | adds numeric key | Uses one greater than the largest finite numeric key when representable; non-finite keys never get overwritten, with a first-free integer fallback for precision edge cases. |
| `prepend(value)` | numeric keys | Places value first and reindexes every value. |
| `remove(key)` | preserves remaining keys | Missing key is a no-op in content, but still returns a new collection. |

### Combining, flow, aggregates and strings

| Method | Result | Important behavior |
| --- | --- | --- |
| `zip(values)` | numeric keys of pairs | Length is the longer side; missing positions are `undefined`. |
| `crossJoin(values)` | numeric keys of pairs | Left-major Cartesian product; either empty side => empty. |
| `reduce(callback, initial)` | native result | Visits in collection order and always requires an explicit initial value. |
| `each(callback)` | same collection instance | Stops only when callback returns literal `false`. |
| `tap(callback)` | same collection instance | Executes callback once for side effects. |
| `pipe(callback)` | callback result | Does not wrap the callback result. |
| `when(condition, callback)` | collection | Runs callback only when condition is true; otherwise returns same instance. |
| `unless(condition, callback)` | collection | Runs callback only when condition is false; otherwise returns same instance. |
| `sum(selector?)` | `number` | Default selector is `Number(value)`; empty => `0`. |
| `avg(selector?)` | number or `undefined` | Alias of `average()`. |
| `average(selector?)` | number or `undefined` | Empty => `undefined`. |
| `min(selector?)` | selected value or `undefined` | Returns the selected comparable, not the original source item. |
| `max(selector?)` | selected value or `undefined` | Returns the selected comparable, not the original source item. |
| `median(selector?)` | number or `undefined` | Sorts selected numeric values; even count => mean of the middle pair. |
| `mode(selector?)` | readonly array | Returns every highest-frequency selected value in first-seen order; empty => `[]`. |
| `join(glue, finalGlue?)` | string | Optional final glue is used only before the final item. |
| `implode(path, glue)` | string | Plucks a typed path, stringifies values, then joins. |
| `[Symbol.iterator]()` | entry iterator | Iterates `[key, value]` pairs and can be passed directly to `new Map(...)`. |

## Usage Cookbook

These examples show the collection API in the kinds of flows where chaining is more useful than isolated one-line examples.

### Query runtime records and keep their original keys

```ts
const users = collect(new Map([
    ["usr_ada", {
        active: true,
        role: "admin",
        profile: { name: "Ada", email: "ada@example.com" },
    }],
    ["usr_grace", {
        active: false,
        role: "member",
        profile: { name: "Grace", email: "grace@example.com" },
    }],
    ["usr_lin", {
        active: true,
        role: "member",
        profile: { name: "Lin", email: "lin@example.com" },
    }],
]))

const activeEmails = users
    .filter((user) => user.active)
    .sortBy("profile.name")
    .pluck("profile.email")

activeEmails.entries()
// [
//   ["usr_ada", "ada@example.com"],
//   ["usr_lin", "lin@example.com"],
// ]
```

Notice that filtering, sorting and plucking did not erase the user IDs. Call `.values()` only when you intentionally want numeric sequence keys.

### Declare a typed provider registry

```ts
const providers = createCollection({
    google: {
        label: "Google",
        strategy: "oauth",
        enabled: true,
    },
    github: {
        label: "GitHub",
        strategy: "oauth",
        enabled: true,
    },
    passkey: {
        label: "Passkey",
        strategy: "webauthn",
        enabled: false,
    },
})

providers.google.id // "google"
providers.passkey.strategy // "webauthn"

const enabledProviders = providers
    .filter((provider) => provider.enabled)
    .map((provider) => ({
        id: provider.id,
        label: provider.label,
    }))
    .values()
```

`providers` is a `DefinedCollection`; `enabledProviders` is a regular `Collection` because its membership is no longer guaranteed to contain every original definition key.

### Build grouped summaries

```ts
const orders = collect([
    { region: "eu", total: 120 },
    { region: "us", total: 90 },
    { region: "eu", total: 30 },
    { region: "apac", total: 75 },
])

const totalsByRegion = orders
    .groupBy("region")
    .mapValues((group) => group.sum((order) => order.total))
    .sort((left, right) => right - left)

totalsByRegion.entries()
// [["eu", 150], ["us", 90], ["apac", 75]]
```

### Reconcile two keyed data sets

```ts
const current = collect(new Map([
    ["a", { version: 1 }],
    ["b", { version: 1 }],
]))

const incoming = [
    ["b", { version: 2 }],
    ["c", { version: 1 }],
] as const

current.union(incoming).entries()
// a@1, b@1, c@1 - existing keys win

current.merge(incoming).entries()
// a@1, b@2, c@1 - incoming keys overwrite

current.replace(incoming).entries()
// a@1, b@2 - unknown c is not added
```

### Select one required record safely

```ts
const accounts = collect([
    { email: "ada@example.com", primary: false },
    { email: "grace@example.com", primary: true },
])

const primary = accounts.sole((account) => account.primary)
```

`sole()` is useful when zero matches and multiple matches are both invalid states. It throws different package error classes for those two cases.

### Create pages and windows without losing source keys

```ts
const events = collect(new Map([
    ["evt_a", { type: "open" }],
    ["evt_b", { type: "edit" }],
    ["evt_c", { type: "save" }],
    ["evt_d", { type: "close" }],
]))

const pages = events.chunk(2)

pages.get(0)?.keys() // ["evt_a", "evt_b"]
pages.get(1)?.keys() // ["evt_c", "evt_d"]

const transitions = events.sliding(2)
transitions.get(0)?.keys() // ["evt_a", "evt_b"]
transitions.get(1)?.keys() // ["evt_b", "evt_c"]
```

The outer chunk/window collection is numerically keyed; each nested collection retains the original event keys.

### Use conditional fluent branches without breaking the chain

```ts
function queryUsers(options: {
    activeOnly: boolean
    limit?: number
}) {
    return users
        .when(options.activeOnly, (collection) =>
            collection.filter((user) => user.active),
        )
        .when(options.limit !== undefined, (collection) =>
            collection.take(options.limit!),
        )
        .sortBy("profile.name")
}
```

When a branch is not selected, `when()` / `unless()` return the exact same instance rather than creating an unnecessary copy.

### Convert only at boundaries

Keep data as a collection while querying it, then explicitly extract the shape required by an API boundary.

```ts
const payload = users
    .filter((user) => user.active)
    .pluck("profile.email")
    .toArray()

await sendEmails(payload)
```

For a keyed native consumer:

```ts
const map = users
    .filter((user) => user.active)
    .toMap()
```

### Use `toObject()` only with property-compatible keys

```ts
const settings = collect(new Map([
    ["theme", "dark"],
    ["density", "compact"],
]))

const object = settings.toObject()
Object.getPrototypeOf(object) === null // true
```

Object keys, arrays and other non-property keys are rejected rather than silently stringified.

## Common Mistakes

### Using `createCollection()` for API results

Do not reach for `createCollection()` merely because data happens to be an object. Its value is the **compile-time definition contract** and injected literal IDs.

```ts
// Prefer this for runtime data:
const users = collect(apiResponse.users)

// Prefer this for a static registry:
const commands = createCollection({
    save: { label: "Save" },
    publish: { label: "Publish" },
})
```

### Expecting deep immutability

Collections protect their own structure, not the internals of your objects. Freeze or copy domain values separately if deep immutability is required.

### Assuming every method reindexes

Filtering normally preserves keys. If you need `0..n-1`, make that intent explicit with `.values()`.

```ts
collect([10, 20, 30])
    .filter((value) => value >= 20)
    .keys()
// [1, 2]

collect([10, 20, 30])
    .filter((value) => value >= 20)
    .values()
    .keys()
// [0, 1]
```

### Treating `get()` as an existence check when values may be `undefined`

```ts
const settings = new Collection<string, string | undefined>([
    ["theme", undefined],
])

settings.get("theme") // undefined
settings.has("theme") // true
```

### Passing a function value directly to `contains()`

`contains()` accepts either a value or a predicate. A function argument is therefore interpreted as a predicate. For function-valued collections, compare through a predicate explicitly.

```ts
const handler = () => {}
const handlers = collect([handler])

handlers.contains((value) => value === handler) // true
```

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


**Behavior:** number or `undefined`. Sorts selected numeric values; even count => mean of the middle pair.
```ts
median(selector?): number | undefined
```

```ts
orders.median((order) => order.total)
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

The test suite is intentionally split by responsibility instead of relying on unit tests alone. A public method is not considered covered merely because one happy-path assertion executes it; its observable contract is exercised from several directions.
The documentation contract also checks that every current public method has an explicit behavior statement, a TypeScript signature and at least one usage example, so API additions cannot silently outgrow the README.

| Layer | Responsibility | Examples |
| --- | --- | --- |
| `tests/unit` | Focused return-value semantics | mapping, filtering, grouping, ordering, aggregation |
| `tests/behavior` | Package-wide invariants and public contracts | immutability, exports, defined-collection access, README/API inventory |
| `tests/guards` | Inputs that must be rejected | fractional sizes, negative offsets where forbidden, `NaN`, `Infinity`, missing items |
| `tests/contracts` | Full method behavior, edge cases and interaction rules | empty/singleton cases, key preservation, duplicate handling, callback arguments, equality semantics |
| `tests/properties` | Laws and generated equivalence checks | reverse involution, filter/reject complements, native slice/chunk equivalence, conservation of values |
| `tests/performance` | Observable work characteristics | one-pass callback counts, short-circuit consumption, large-input cardinality conservation |
| `tests/types*.test.ts` | Compile-time API contracts | literal IDs, nested paths, narrowing, overload inference and expected TypeScript failures |
| `benchmarks` | Timing observations, outside correctness gates | construction, transformations, grouping, sorting, pipelines and defined lookups |

The suite explicitly covers both **what must happen** and **what must not happen**. Examples include callbacks that must short-circuit instead of reading the remainder of a lazy iterable, transformations that must not mutate their source, missing keys that must not be confused with present `undefined` values, and invalid numeric arguments that must fail rather than being silently rounded or coerced.

Performance correctness is separated from wall-clock benchmarking. Tests assert deterministic properties such as callback counts and short-circuit work; benchmarks report elapsed time without making CI depend on machine speed.

Run the complete runtime suite with Bun:

```bash
bun run test:runtime
```

Run an individual layer while developing:

```bash
bun run test:unit
bun run test:behavior
bun run test:guards
bun run test:contracts
bun run test:properties
bun run test:performance
bun run test:docs
bun run test:types
```

Generate Bun's runtime coverage report:

```bash
bun run test:coverage
```

`bunfig.toml` excludes test files themselves and sets the package coverage threshold to 100%. Adding an executable source path without a corresponding test therefore makes the coverage command fail instead of silently reducing the baseline.

Run every correctness and type-contract layer:

```bash
bun run test
```

Run the complete release check:

```bash
bun run check
```

The runtime suite is written with `bun:test`; it does not depend on Node's test runner.

### Benchmarks

Benchmarks are deliberately separate from correctness tests. They report timing data without turning machine-dependent performance into flaky pass/fail assertions.

```bash
bun run benchmark
```

The default benchmark uses a 25,000-item primary data set, derives smaller and larger size tiers from it, performs 3 warmups and records 15 measured samples. Defined-collection lookup cases run 250,000 iterations by default. Override those values when profiling a particular workload:

```bash
COLLECTION_BENCH_SIZE=100000 \
COLLECTION_BENCH_SAMPLES=30 \
COLLECTION_BENCH_WARMUPS=5 \
COLLECTION_BENCH_LOOKUPS=1000000 \
bun run benchmark
```

The report includes median and p95 time, operations per second and processed items per second for:

- collection construction and extraction;
- native `Array#map().filter()` as local context;
- collection `map().filter()` and query pipelines;
- `groupBy()` and `countBy()`;
- selector-based `unique()`;
- `chunk()`;
- `sortBy()`;
- a multi-stage fluent pipeline;
- `createCollection()` direct-property and `get()` lookup paths.

There is intentionally **no timing pass/fail threshold**. CI machines, laptops, power modes and runtime versions differ too much for a fixed duration to be a correctness contract. Use benchmark output to compare revisions under the same environment, while `tests/performance` protects deterministic work characteristics that can safely fail a test.

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

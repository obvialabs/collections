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


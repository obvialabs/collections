# @obvia/collections

A strongly typed, immutable collection toolkit for TypeScript.

`@obvia/collections` gives arrays, object records, maps, and keyed iterables one fluent API while preserving their meaningful key and value types.

```ts
import { collect } from "@obvia/collections"
```

## Installation

```bash
bun add @obvia/collections
```

The package is ESM-only, has no runtime dependencies, and ships TypeScript declarations and source maps.

## Quick start

```ts
import { collect } from "@obvia/collections"

const users = collect([
    { name: "Ada", role: "admin", active: true },
    { name: "Grace", role: "member", active: false },
    { name: "Linus", role: "member", active: true },
])

const names = users
    .filter((user) => user.active)
    .sortBy("name")
    .pluck("name")
    .items()

// ["Ada", "Linus"]
```

Object records use the same factory and the same Collection API:

```ts
const providers = collect({
    google: {
        label: "Google",
        enabled: true,
    },
    github: {
        label: "GitHub",
        enabled: false,
    },
})

providers.get("google")?.label
// "Google"

providers.toObject().github.label
// "GitHub"
```

There is only one creation model to learn: **give `collect()` your data, work through Collection methods, and convert at the boundary when needed.**

## One factory, one model

`collect()` accepts the common JavaScript collection sources:

| Source | Key behavior | Value behavior |
| --- | --- | --- |
| no argument | empty numeric collection | — |
| array / readonly array | `0..n-1` | values preserved |
| object record | enumerable own string keys | values preserved |
| `ReadonlyMap` | key identity preserved | values preserved |
| entry iterable | yielded keys preserved | yielded values preserved |
| existing `Collection` | unchanged | same instance returned |

```ts
const numbers = collect([10, 20, 30])
const settings = collect({ theme: "system", locale: "en" })
const keyed = collect(new Map([["first", 10], ["second", 20]]))
```

### Object records are data, not definitions

Object keys become Collection keys. The values are not modified, cloned, or decorated.

```ts
const source = {
    google: { label: "Google" },
}

const providers = collect(source)

providers.get("google") === source.google
// true

providers.get("google")
// { label: "Google" }
```

`collect()` never synthesizes an `id` field from an object key. If an ID belongs in the domain model, keep it explicit in the data:

```ts
const providers = collect({
    google: {
        id: "google",
        label: "Google",
    },
})
```

This keeps the Collection layer from silently changing source data.

### Collection keys never become Collection properties

Object keys do not get attached to the Collection instance:

```ts
const providers = collect({
    google: { label: "Google" },
    map: { label: "Map provider" },
})

providers.get("google")
providers.get("map")

providers.map((provider) => provider.label)
// `map` remains the Collection method
```

That rule completely avoids collisions with names such as `map`, `filter`, `count`, `constructor`, or future Collection methods.

When object-style access is useful, convert explicitly:

```ts
const object = providers.toObject()

object.google.label
object.map.label
```

`toObject()` returns a null-prototype snapshot, so keys such as `__proto__` are data rather than prototype mutation hooks.

### Literal object typing is preserved

Object literals keep their exact key set, and `toObject()` keeps key-specific value types:

```ts
const panels = collect({
    editor: {
        kind: "editor" as const,
        language: "typescript",
    },
    preview: {
        kind: "preview" as const,
        device: "desktop",
    },
})

panels.get("editor")?.language
// string

const object = panels.toObject()

object.editor.language
object.preview.device

// panels.get("missing")
// TypeScript error
```

Fluent transformations return regular `Collection` values. That is intentional: a transform may change values or keys, so the original object key-to-specific-value relationship may no longer be valid.

### Object input follows `Object.entries()`

For object records, runtime membership follows `Object.entries()` semantics:

- enumerable own string properties are collected;
- inherited properties are ignored;
- non-enumerable properties are ignored;
- numeric object keys normalize to strings;
- symbol properties are ignored.

Record-like objects created with `Object.create(customPrototype)` are accepted. Structured instances such as `Date`, `RegExp`, and class instances are rejected rather than silently interpreted as records.

## Core model

A `Collection<TKey, TValue>` keeps keys and values together. Transformations return new collections and leave the source membership unchanged.

```ts
const source = collect(new Map([
    ["a", 3],
    ["b", 1],
    ["c", 2],
]))

const sorted = source.sort()

source.items()
// [3, 1, 2]

sorted.items()
// [1, 2, 3]
```

### Keys are first-class

Callbacks receive both value and key where the operation needs them:

```ts
const labels = collect({
    primary: "Save",
    secondary: "Cancel",
})

labels.map((label, key) => `${key}:${label}`)
```

Methods preserve or replace keys according to their meaning. `filter()` and `map()` preserve keys; `keyBy()` derives new keys; `values()` intentionally reindexes values numerically.

### Immutability is structural

Operations do not mutate Collection membership:

```ts
const source = collect([1, 2, 3])
const changed = source.with(1, 20)

source.items()
// [1, 2, 3]

changed.items()
// [1, 20, 3]
```

Contained values are not deep-cloned or frozen. Mutating an object stored as a value remains visible through every reference to that object.

### Equality uses JavaScript semantics

Membership and set operations use JavaScript-oriented equality rather than coercive comparisons.

```ts
const records = collect([
    { id: 1, email: "a@example.com" },
    { id: 2, email: "a@example.com" },
])

records.unique((record) => record.email).count()
// 1
```

### Ordering is stable

Ordering methods preserve input order when compared values are equal.

```ts
const users = collect([
    { name: "first", score: 10 },
    { name: "second", score: 10 },
])

users.sortByDesc("score").pluck("name").items()
// ["first", "second"]
```

Selector ordering handles `null`, `undefined`, and `NaN` deterministically rather than relying on engine-specific coercion.

## Common workflows

### Filter, order, and project records

```ts
const users = collect(new Map([
    ["ada", { role: "admin", score: 95 }],
    ["grace", { role: "member", score: 88 }],
    ["linus", { role: "admin", score: 91 }],
]))

const admins = users
    .where("role", "admin")
    .sortByDesc("score")
    .map((user, key) => ({ key, score: user.score }))
```

### Group and summarize

```ts
const orders = collect([
    { status: "paid", total: 120 },
    { status: "paid", total: 80 },
    { status: "pending", total: 40 },
])

const totals = orders
    .groupBy("status")
    .mapValues((group) => group.sum("total"))

totals.toObject()
// { paid: 200, pending: 40 }
```

### Use type-safe nested paths

```ts
const users = collect([
    {
        profile: {
            email: "ada@example.com",
            metrics: { score: 98 },
        },
    },
])

users.pluck("profile.email")
users.sortBy("profile.metrics.score")
users.sum("profile.metrics.score")

// users.pluck("profile.missing")
// TypeScript error
```

Optional intermediate properties remain optional in the inferred output type.

### Project and regroup

```ts
const summaries = users.select(["id", "name", "team"] as const)

const namesByTeam = users.mapToGroups((user) => [
    user.team,
    user.name,
] as const)
```

For nested object data, `dot()` and `undot()` provide explicit shape conversion:

```ts
const settings = collect({
    appearance: {
        theme: "dark",
    },
})

const flat = settings.dot()
const restored = flat.undot()
```

`flatten()` is different: it flattens nested **iterable values**. It is not an object-view or property-access operation.

```ts
collect([[1, 2], [3]]).flatten().items()
// [1, 2, 3]
```

### Work with windows and pages

```ts
const records = collect(Array.from({ length: 20 }, (_, index) => index + 1))

records.take(5)
records.skip(5).take(5)
records.chunk(5)
records.sliding(3, 1)
records.forPage(2, 5)
```

Invalid size and count arguments are rejected rather than silently normalized.

### Reconcile keyed data

```ts
const defaults = collect({
    theme: "system",
    locale: "en",
})

const overrides = collect({
    locale: "tr",
})

const settings = defaults.merge(overrides)

settings.toObject()
// { theme: "system", locale: "tr" }
```

Use `diffKeys()` and `intersectByKeys()` when key identity matters; use `diff()` and `intersect()` when value identity matters.

### Convert at boundaries

Keep the fluent abstraction while processing and choose the native representation only where it is needed:

```ts
const activeUsers = collect(users)
    .filter((user) => user.active)
    .sortBy("name")

activeUsers.items()
activeUsers.toArray()
activeUsers.toMap()
activeUsers.toObject()
```

`toObject()` rejects non-property keys and rejects collisions caused by JavaScript property-key normalization, such as a collection containing both numeric key `1` and string key `"1"`.

## API at a glance

The table is intentionally compact. Complete behavior, signatures, examples, edge cases, and return semantics live in the **[API reference](docs/api.md)**.

| Area | Methods |
| --- | --- |
| State & extraction | `count`, `empty`, `notEmpty`, `items`, `all`, `keys`, `entries`, `values` |
| Conversion | `toArray`, `toMap`, `toObject` |
| Access & selection | `get`, `getOr`, `has`, `hasAny`, `hasAll`, `hasMany`, `hasSole`, `before`, `after`, `search`, `first`, `firstWhere`, `firstOrFail`, `last`, `lastOrFail`, `sole`, `nth`, `random` |
| Transformation | `map`, `mapValues`, `mapKeys`, `mapWithKeys`, `mapInto`, `mapSpread`, `mapToGroups`, `flatMap`, `flatten`, `collapse`, `collapseWithKeys`, `multiply`, `pluck`, `keyBy`, `select`, `dot`, `undot` |
| Filtering | `filter`, `reject`, `where`, `whereNot`, `whereIn`, `whereNotIn`, `whereNull`, `whereNotNull`, `whereBetween`, `whereNotBetween`, `whereInstanceOf` |
| Predicates | `contains`, `doesntContain`, `every`, `some` |
| Subsets & windows | `only`, `except`, `take`, `skip`, `slice`, `takeUntil`, `takeWhile`, `skipUntil`, `skipWhile`, `chunk`, `chunkWhile`, `sliding`, `split`, `splitIn`, `forPage`, `pad`, `partition` |
| Ordering | `reverse`, `shuffle`, `sort`, `sortBy`, `sortByDesc`, `sortDesc`, `sortKeys`, `sortKeysDesc`, `sortKeysUsing` |
| Grouping | `groupBy`, `countBy` |
| Sets | `unique`, `duplicates`, `diff`, `intersect`, `diffAssoc`, `intersectAssoc`, `diffKeys`, `intersectByKeys`, `union` |
| Immutable updates | `merge`, `replace`, `with`, `append`, `prepend`, `remove` |
| Combining | `combine`, `concat`, `flip`, `zip`, `crossJoin` |
| Reduction & flow | `reduce`, `reduceSpread`, `each`, `eachSpread`, `tap`, `pipe`, `pipeInto`, `pipeThrough`, `when`, `unless`, `whenEmpty`, `whenNotEmpty`, `unlessEmpty`, `unlessNotEmpty` |
| Aggregates | `sum`, `avg`, `average`, `percentage`, `min`, `max`, `median`, `mode` |
| Strings | `join`, `implode` |
| Iteration | `[Symbol.iterator]` |

## TypeScript behavior

### Type guards narrow values

```ts
const values = collect<number | null>([1, null, 3])

const numbers = values.filter(
    (value): value is number => value !== null,
)

numbers.items()
// readonly number[]
```

### Object keys stay literal

```ts
const statuses = collect({
    draft: { terminal: false },
    published: { terminal: true },
} as const)

statuses.keys()
// readonly ("draft" | "published")[]

statuses.get("draft")

// statuses.get("missing")
// TypeScript error
```

For object sources, `toObject()` also preserves each property's source value type.

## Iteration

Collections iterate as key/value entries:

```ts
for (const [key, value] of collection) {
    console.log(key, value)
}
```

Use `items()` when only values are needed.

## Errors

The package exports collection-specific errors for operations that require a result but cannot satisfy their contract:

```ts
import {
    CollectionItemNotFoundError,
    CollectionMultipleItemsError,
} from "@obvia/collections"
```

Typical throwing operations include `firstOrFail()`, `lastOrFail()`, and `sole()`.

## Package exports

```ts
import {
    Collection,
    collect,
} from "@obvia/collections"
```

Focused subpath imports are also available:

```ts
import { Collection } from "@obvia/collections/collection"
import { collect } from "@obvia/collections/collect"
```

## Testing and quality

Runtime tests use `bun:test`. Verification is split by responsibility:

```bash
bun run test
bun run test:coverage
bun run benchmark
```

The suite covers unit behavior, public contracts, negative behavior, collection invariants, native-equivalence properties, type-level contracts, and deterministic operation-count expectations. Wall-clock benchmark results are observational and are not used as correctness assertions.

GitHub Actions keep **Test**, **Coverage**, and **Benchmark** independent. Publishing remains manual.

### Local development

```bash
bun install
bun run typecheck
bun run test
bun run build
```

Focused suites are available through `test:unit`, `test:behavior`, `test:guards`, `test:contracts`, `test:properties`, `test:performance`, and `test:types`.

## Documentation

- **[API reference](docs/api.md)** — complete signatures, behavior, examples, edge cases, and errors.
- **[Release guide](docs/releasing.md)** — manual verification and publishing checklist.
- **[CHANGELOG](CHANGELOG.md)** — release history and noteworthy changes.

## License

MIT

# @obvia/collections

A strongly typed, immutable collection toolkit for TypeScript.

`@obvia/collections` gives keyed runtime data a fluent API without forcing it into arrays, and adds a second factory for source-defined registries whose object keys should become stable item IDs.

```ts
import { collect, createCollection } from "@obvia/collections"
```

## Installation

```bash
bun add @obvia/collections
```

The package is also installable with npm-compatible package managers:

```bash
npm install @obvia/collections
pnpm add @obvia/collections
yarn add @obvia/collections
```

The package is ESM-only, has no runtime dependencies, and ships TypeScript declarations.

## Quick start

Use `collect()` when the values already exist at runtime:

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

Use `createCollection()` when the keys in a definition are part of the domain model:

```ts
import { createCollection } from "@obvia/collections"

const providers = createCollection({
    google: {
        label: "Google",
        enabled: true,
    },
    github: {
        label: "GitHub",
        enabled: true,
    },
})

providers.google.id
// "google"

providers.github.label
// "GitHub"
```

Both factories return the same fluent collection abstraction. The difference is how the root collection is created and typed.

## `collect()` vs `createCollection()`

This distinction is the most important concept in the package.

| | `collect()` | `createCollection()` |
| --- | --- | --- |
| Intended input | Runtime data | Source-defined keyed definitions |
| Arrays | Yes | No |
| Maps / entry iterables | Yes | No |
| Plain objects | Yes | Yes, as definitions |
| Injects an `id` field | No | Yes, from each object key |
| Direct `collection.someKey` access | No | Yes, when the key does not collide with the API |
| Preserves literal definition keys | As normal keys | Yes, including key-specific item types |
| Fluent transformations | `Collection` | Return regular `Collection` values |

### Choose `collect()` for runtime data

Use it for values coming from APIs, databases, files, computed results, arrays, maps, and iterables.

```ts
const response = [
    { id: "a", score: 82 },
    { id: "b", score: 97 },
    { id: "c", score: 74 },
]

const ranked = collect(response)
    .sortByDesc("score")
    .take(2)

ranked.items()
```

`collect()` does not modify your values:

```ts
const users = collect({
    ada: { name: "Ada" },
})

users.get("ada")
// { name: "Ada" }

// No generated `id` was added.
```

### Choose `createCollection()` for definitions

Use it when the keys themselves identify definitions such as providers, commands, panels, routes, tools, adapters, or UI slides.

```ts
const commands = createCollection({
    save: {
        label: "Save",
        shortcut: "Mod+S",
    },
    publish: {
        label: "Publish",
        shortcut: "Mod+Shift+P",
    },
})

commands.save.id
// "save"

commands.get("publish")?.shortcut
// "Mod+Shift+P"
```

The generated `id` is canonical. A value cannot override the definition key:

```ts
const definitions = createCollection({
    security: {
        id: "wrong",
        title: "Security",
    },
})

definitions.security.id
// "security"
```

### Direct access exists only on the definition root

Direct property access is a convenience of the typed object produced by `createCollection()`:

```ts
const providers = createCollection({
    google: { enabled: true },
    github: { enabled: false },
})

providers.google
```

A transformation returns a regular `Collection`, because the original literal-key-to-value relationship may no longer be valid:

```ts
const enabled = providers.filter((provider) => provider.enabled)

enabled.get("google")
// supported

// enabled.google
// intentionally not part of the transformed type
```

That rule keeps fluent transformations honest instead of pretending their output still has the original static definition shape.

### Method-name collisions stay safe

Collection methods win when a definition key has the same name as part of the API. The item is still available through `get()`.

```ts
const definitions = createCollection({
    map: { label: "Map definition" },
    filter: { label: "Filter definition" },
    security: { label: "Security" },
})

definitions.map((item) => item.label)
definitions.get("map")?.label
// "Map definition"

definitions.security.label
// "Security"
```

This avoids maintaining an artificial list of forbidden definition IDs.

## Core model

A `Collection<TKey, TValue>` keeps keys and values together. Most transformations return a new collection and leave the source untouched.

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

Callbacks receive both value and key:

```ts
const labels = collect({
    primary: "Save",
    secondary: "Cancel",
})

labels.map((label, key) => `${key}:${label}`)
```

Methods preserve or replace keys according to their meaning. For example, `filter()` preserves keys, `map()` preserves keys, `keyBy()` derives new keys, and `values()` creates a numerically keyed collection.

### Immutability is structural

Collection operations do not mutate the source collection:

```ts
const source = collect([1, 2, 3])
const changed = source.with(1, 20)

source.items()
// [1, 2, 3]

changed.items()
// [1, 20, 3]
```

Values themselves are not deep-cloned or frozen. If a collection contains mutable objects, mutating one of those objects is still visible through every reference to that object.

### Equality uses JavaScript semantics

Set and membership operations use strict JavaScript-oriented equality behavior rather than coercive comparisons. When identity should be based on a field, use a selector or predicate where the method supports one.

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

`null`, `undefined`, and `NaN` are handled deterministically by selector-based ordering rather than relying on engine-specific coercion.

## Common workflows

### Filter, order, and project runtime records

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

admins.items()
```

### Group records and summarize each group

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

Nested property selectors are checked by TypeScript:

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

Optional nested properties remain optional in the inferred output type.

### Select one required record

Use the throwing variants when absence is a programming or domain error:

```ts
const configuration = collect({
    locale: "en",
    timezone: "UTC",
})

const locale = configuration.get("locale")
const required = configuration.only(["locale"]).sole()
```

`firstOrFail()`, `lastOrFail()`, and `sole()` use exported collection error classes so callers can distinguish collection contract failures from unrelated exceptions.

### Work with windows and pages

```ts
const records = collect(Array.from({ length: 20 }, (_, index) => index + 1))

const firstPage = records.take(5)
const secondPage = records.skip(5).take(5)
const chunks = records.chunk(5)
const windows = records.sliding(3, 1)
```

All invalid size/count arguments are rejected rather than silently normalized into surprising output.

### Apply conditional pipelines

```ts
const query = collect(users)

const result = query
    .when(includeInactive, (items) => items)
    .unless(sortDisabled, (items) => items.sortBy("name"))
    .take(limit)
```

`tap()` is useful for observation without breaking a chain, while `pipe()` intentionally exits or reshapes the chain based on the callback return value.

### Project and regroup records

Use `select()` when downstream code needs only a stable subset of each record, and `mapToGroups()` when one projection should become grouped output.

```ts
const summaries = users.select(["id", "name", "team"] as const)

const namesByTeam = users.mapToGroups((user) => [
    user.team,
    user.name,
] as const)

const flattenedSettings = settings.dot()
const restoredSettings = flattenedSettings.undot()
```

These operations remain immutable: projection and regrouping never rewrite the source collection.

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

### Convert only at boundaries

Keep the fluent abstraction while processing and convert when data leaves the collection layer:

```ts
const activeUsers = collect(users)
    .filter((user) => user.active)
    .sortBy("name")

const values = activeUsers.items()
const keyed = activeUsers.toMap()
const object = activeUsers.toObject()
```

`toObject()` should only be used when the collection keys are valid property keys for the intended object representation.

## API at a glance

The table below is intentionally compact. The complete behavior, signatures, examples, error cases, and return semantics for every method live in the **[API reference](docs/api.md)**.

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

Full reference: **[docs/api.md](docs/api.md)**

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

### Definition access keeps key-specific item types

```ts
const panels = createCollection({
    editor: {
        kind: "editor" as const,
        language: "typescript",
    },
    preview: {
        kind: "preview" as const,
        device: "desktop",
    },
})

panels.editor.language
panels.preview.device

panels.get("editor")?.language
```

The return type of `get("editor")` is tied to the literal key rather than widened to the union of every definition item.

## Iteration

Collections are iterable as key/value entries:

```ts
for (const [key, value] of collection) {
    console.log(key, value)
}
```

Use `items()` when only values are needed:

```ts
for (const value of collection.items()) {
    console.log(value)
}
```

## Errors

The package exports collection-specific errors for operations that require a result but cannot satisfy their contract:

```ts
import {
    CollectionItemNotFoundError,
    CollectionMultipleItemsError,
} from "@obvia/collections"
```

Typical throwing operations include `firstOrFail()`, `lastOrFail()`, and `sole()`. See the [API reference](docs/api.md#errors) for exact behavior.

## Package exports

```ts
import {
    Collection,
    collect,
    createCollection,
} from "@obvia/collections"
```

Focused subpath imports are also available:

```ts
import { Collection } from "@obvia/collections/collection"
import { collect } from "@obvia/collections/collect"
import { createCollection } from "@obvia/collections/create-collection"
```

## Testing and quality

The package uses Bun for runtime tests. Verification is intentionally split by responsibility:

```bash
bun run test
bun run test:coverage
bun run benchmark
```

The suite covers unit behavior, public contracts, negative/guard behavior, collection invariants, native-equivalence properties, type-level contracts, and deterministic operation-count expectations. Wall-clock benchmark results are observational and are not used as correctness assertions.

GitHub Actions run these concerns independently:

- **Test** validates runtime behavior, types, and package build integrity.
- **Coverage** enforces the configured source coverage threshold and publishes the LCOV report as a workflow artifact.
- **Benchmark** records performance measurements independently so noisy timing data cannot make correctness checks flaky.

### Local development

```bash
bun install
bun run typecheck
bun run test
bun run build
```

Focused suites are available when working on a specific contract:

```bash
bun run test:unit
bun run test:behavior
bun run test:guards
bun run test:contracts
bun run test:properties
bun run test:performance
bun run test:types
```

## Documentation

- **[API reference](docs/api.md)** — complete method signatures, behavior, examples, edge cases, and errors.
- **[Release guide](docs/releasing.md)** — manual verification and publishing checklist.
- **[CHANGELOG](CHANGELOG.md)** — release history and noteworthy changes.

## License

MIT

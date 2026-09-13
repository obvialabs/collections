import {
    Collection,
    collect,
    createCollection,
    type CollectionItem,
    type CollectionItems,
    type DefinedCollection,
} from "../src/index"

type Equal<TLeft, TRight> =
    (<T>() => T extends TLeft ? 1 : 2) extends
    (<T>() => T extends TRight ? 1 : 2)
        ? true
        : false

type Expect<TValue extends true> = TValue

type Extends<TValue, TExpected> = TValue extends TExpected ? true : false

// ---------------------------------------------------------------------------
// collect()
// ---------------------------------------------------------------------------

const empty = collect()
type _Empty = Expect<Equal<typeof empty, Collection<number, unknown>>>

const arrayCollection = collect(["alpha", "beta"] as const)
type _ArrayKeys = Expect<Equal<ReturnType<typeof arrayCollection.keys>[number], number>>
type _ArrayValues = Expect<Equal<ReturnType<typeof arrayCollection.items>[number], "alpha" | "beta">>

const readonlyArray: readonly number[] = [1, 2, 3]
const readonlyArrayCollection = collect(readonlyArray)
type _ReadonlyArray = Expect<Equal<typeof readonlyArrayCollection, Collection<number, number>>>

const objectCollection = collect({ alpha: 1, beta: "two" } as const)
type _ObjectKeys = Expect<Equal<ReturnType<typeof objectCollection.keys>[number], "alpha" | "beta">>
type _ObjectValues = Expect<Equal<ReturnType<typeof objectCollection.items>[number], 1 | "two">>

const runtimeRegistry = collect({
    google: { label: "Google" },
    github: { label: "GitHub" },
} as const)
type _RuntimeRegistryKeys = Expect<Equal<ReturnType<typeof runtimeRegistry.keys>[number], "google" | "github">>

// `collect()` preserves runtime values; it does not inject IDs or direct properties.
// @ts-expect-error direct definition properties belong to createCollection() only
runtimeRegistry.google
// @ts-expect-error collect() does not synthesize an id field
runtimeRegistry.get("google")?.id

const mapCollection = collect(new Map<"a" | "b", number>([["a", 1], ["b", 2]]))
type _MapCollection = Expect<Equal<typeof mapCollection, Collection<"a" | "b", number>>>

const entryCollection = collect([["a", 1], ["b", 2]] as const)
type _EntryArrayIsArrayCollection = Expect<Equal<typeof entryCollection, Collection<number, readonly ["a", 1] | readonly ["b", 2]>>>

function* entryGenerator(): Generator<readonly ["a" | "b", number]> {
    yield ["a", 1]
    yield ["b", 2]
}
const iterableCollection = collect(entryGenerator())
type _IterableCollection = Expect<Equal<typeof iterableCollection, Collection<"a" | "b", number>>>

const existing = collect([1, 2, 3])
const same = collect(existing)
type _Existing = Expect<Equal<typeof same, typeof existing>>

// ---------------------------------------------------------------------------
// createCollection()
// ---------------------------------------------------------------------------

const slides = createCollection({
    canvas: {
        title: "Canvas",
        meta: { enabled: true, score: 10 },
    },
    security: {
        title: "Security",
        meta: { enabled: false, score: 20 },
    },
    map: {
        title: "Map",
        meta: { enabled: true, score: 30 },
    },
})

type SlidesDefinition = {
    readonly canvas: {
        readonly title: "Canvas"
        readonly meta: { readonly enabled: true; readonly score: 10 }
    }
    readonly security: {
        readonly title: "Security"
        readonly meta: { readonly enabled: false; readonly score: 20 }
    }
    readonly map: {
        readonly title: "Map"
        readonly meta: { readonly enabled: true; readonly score: 30 }
    }
}

type _SlidesIsDefined = Expect<Extends<typeof slides, DefinedCollection<SlidesDefinition>>>
type _CanvasId = Expect<Equal<typeof slides.canvas.id, "canvas">>
type _SecurityTitle = Expect<Equal<typeof slides.security.title, "Security">>
type _Keys = Expect<Equal<ReturnType<typeof slides.keys>[number], "canvas" | "security" | "map">>
type _MapRemainsMethod = Expect<Equal<typeof slides.map extends (...args: any[]) => any ? true : false, true>>

const security = slides.get("security")
type _ExactGetId = Expect<Equal<NonNullable<typeof security>["id"], "security">>
type _ExactGetTitle = Expect<Equal<NonNullable<typeof security>["title"], "Security">>

type _CollectionItem = Expect<Equal<
    CollectionItem<SlidesDefinition, "canvas">["id"],
    "canvas"
>>
type _CollectionItems = Expect<Equal<
    CollectionItems<SlidesDefinition>["id"],
    "canvas" | "security" | "map"
>>

const overriddenId = createCollection({
    primary: {
        id: "wrong",
        label: "Primary",
    },
})
type _CanonicalId = Expect<Equal<typeof overriddenId.primary.id, "primary">>

// ---------------------------------------------------------------------------
// key-preserving transformations
// ---------------------------------------------------------------------------

const mapped = slides.map((slide) => slide.title.length)
type _MappedKeys = Expect<Equal<ReturnType<typeof mapped.keys>[number], "canvas" | "security" | "map">>
type _MappedValues = Expect<Equal<ReturnType<typeof mapped.items>[number], number>>

const mappedValues = slides.mapValues((slide) => slide.meta.score)
type _MapValuesKeys = Expect<Equal<ReturnType<typeof mappedValues.keys>[number], "canvas" | "security" | "map">>
type _MapValues = Expect<Equal<ReturnType<typeof mappedValues.items>[number], 10 | 20 | 30>>

const filtered = slides.filter((slide) => slide.meta.enabled)
type _FilteredKeys = Expect<Equal<ReturnType<typeof filtered.keys>[number], "canvas" | "security" | "map">>

const nullableValues: readonly (number | null)[] = [1, null, 2]
const narrowed = collect(nullableValues).filter(
    (value): value is number => value !== null,
)
type _Narrowed = Expect<Equal<typeof narrowed, Collection<number, number>>>

const firstNarrowed = collect([1, "two"] as Array<number | string>).first(
    (value): value is string => typeof value === "string",
)
type _FirstNarrowed = Expect<Equal<typeof firstNarrowed, string | undefined>>

// ---------------------------------------------------------------------------
// re-keying and re-indexing
// ---------------------------------------------------------------------------

const keyMapped = slides.mapKeys((slide) => slide.title)
type _MapKeys = Expect<Equal<ReturnType<typeof keyMapped.keys>[number], "Canvas" | "Security" | "Map">>

const pairMapped = slides.mapWithKeys((slide) => [slide.id, slide.title.length] as const)
type _MapWithKeysKeys = Expect<Equal<ReturnType<typeof pairMapped.keys>[number], "canvas" | "security" | "map">>
type _MapWithKeysValues = Expect<Equal<ReturnType<typeof pairMapped.items>[number], number>>

const flatMapped = collect([1, 2] as const).flatMap((value) => [String(value)])
type _FlatMap = Expect<Equal<typeof flatMapped, Collection<number, string>>>

const collapsed = collect([[1, 2], [3]] as const).collapse()
type _CollapseKeys = Expect<Equal<ReturnType<typeof collapsed.keys>[number], number>>
type _CollapseValues = Expect<Equal<ReturnType<typeof collapsed.items>[number], 1 | 2 | 3>>

const valuesCollection = slides.values()
type _ValuesKeys = Expect<Equal<ReturnType<typeof valuesCollection.keys>[number], number>>
type _ValuesItems = Expect<Equal<ReturnType<typeof valuesCollection.items>[number]["id"], "canvas" | "security" | "map">>

const prepended = slides.prepend({ id: "intro" as const })
type _PrependKeys = Expect<Equal<ReturnType<typeof prepended.keys>[number], number>>
type _PrependValues = Expect<Equal<ReturnType<typeof prepended.items>[number]["id"], "canvas" | "security" | "map" | "intro">>

// ---------------------------------------------------------------------------
// nested paths
// ---------------------------------------------------------------------------

const emails = createCollection({
    ada: { profile: { email: "ada@example.com", score: 10 } },
    grace: { profile: { email: "grace@example.com", score: 20 } },
}).pluck("profile.email")
type _Pluck = Expect<Equal<ReturnType<typeof emails.items>[number], "ada@example.com" | "grace@example.com">>

const keyed = slides.keyBy("title")
type _KeyBy = Expect<Equal<ReturnType<typeof keyed.keys>[number], "Canvas" | "Security" | "Map">>

const grouped = slides.groupBy("meta.enabled")
type _GroupBy = Expect<Equal<ReturnType<typeof grouped.keys>[number], boolean>>
type _GroupValue = Expect<Extends<ReturnType<typeof grouped.items>[number], Collection<"canvas" | "security" | "map", CollectionItems<SlidesDefinition>>>>

const counted = slides.countBy("meta.enabled")
type _CountBy = Expect<Equal<ReturnType<typeof counted.keys>[number], boolean>>
type _CountByValues = Expect<Equal<ReturnType<typeof counted.items>[number], number>>

const sorted = slides.sortBy("meta.score")
type _SortByKeys = Expect<Equal<ReturnType<typeof sorted.keys>[number], "canvas" | "security" | "map">>

const where = slides.where("meta.enabled", true)
type _WhereKeys = Expect<Equal<ReturnType<typeof where.keys>[number], "canvas" | "security" | "map">>

const optionalUsers = collect([] as Array<{ profile?: { email: string }; tags: string[] }>)
const optionalEmails = optionalUsers.pluck("profile.email")
type _OptionalNestedPath = Expect<Equal<ReturnType<typeof optionalEmails.items>[number], string | undefined>>

// ---------------------------------------------------------------------------
// grouping, sets, updates and combinations
// ---------------------------------------------------------------------------

const merged = collect(new Map<"a", number>([["a", 1]])).merge([["b", "two"]] as const)
type _MergeKeys = Expect<Equal<ReturnType<typeof merged.keys>[number], "a" | "b">>
type _MergeValues = Expect<Equal<ReturnType<typeof merged.items>[number], number | "two">>

const extended = collect([1, 2]).with("total", 3)
type _WithKeys = Expect<Equal<ReturnType<typeof extended.keys>[number], number | string>>
type _WithValues = Expect<Equal<ReturnType<typeof extended.items>[number], number>>

const appended = slides.append("end" as const)
type _AppendKeys = Expect<Equal<ReturnType<typeof appended.keys>[number], "canvas" | "security" | "map" | number>>
type _AppendValues = Expect<Equal<ReturnType<typeof appended.items>[number], CollectionItems<SlidesDefinition> | "end">>

const zipped = collect([1, 2] as const).zip(["a", "b"])
type _Zip = Expect<Equal<ReturnType<typeof zipped.items>[number], readonly [1 | 2 | undefined, string | undefined]>>

const crossed = collect([1, 2] as const).crossJoin(["a", "b"])
type _CrossJoin = Expect<Equal<ReturnType<typeof crossed.items>[number], readonly [1 | 2, string]>>

const partitioned = slides.partition((slide) => slide.meta.enabled)
type _PartitionFirst = Expect<Equal<typeof partitioned[0], Collection<"canvas" | "security" | "map", CollectionItems<SlidesDefinition>>>>
type _PartitionSecond = Expect<Equal<typeof partitioned[1], Collection<"canvas" | "security" | "map", CollectionItems<SlidesDefinition>>>>

// ---------------------------------------------------------------------------
// aggregate return types
// ---------------------------------------------------------------------------

const numeric = collect([1, 2, 3])
type _Sum = Expect<Equal<ReturnType<typeof numeric.sum>, number>>
type _Average = Expect<Equal<ReturnType<typeof numeric.average>, number | undefined>>
type _Median = Expect<Equal<ReturnType<typeof numeric.median>, number | undefined>>
const modes = numeric.mode()
type _Mode = Expect<Equal<typeof modes[number], 1 | 2 | 3>>

const minScore = slides.min((slide) => slide.meta.score)
type _MinSelector = Expect<Equal<typeof minScore, 10 | 20 | 30 | undefined>>

const piped = slides.pipe((collection) => collection.count())
type _PipeResult = Expect<Equal<typeof piped, number>>

// ---------------------------------------------------------------------------
// expected compile-time failures
// ---------------------------------------------------------------------------

// @ts-expect-error invalid direct collection key
slides.unknown

// @ts-expect-error runtime method collisions are not exposed as direct items
slides.map.title

// @ts-expect-error invalid nested path
slides.pluck("meta.missing")

// @ts-expect-error arrays are terminal values in nested paths
optionalUsers.pluck("tags.length")

// @ts-expect-error invalid nested path on sort
slides.sortBy("meta.missing")

// @ts-expect-error invalid nested path on grouping
slides.groupBy("meta.missing")

// @ts-expect-error invalid nested path on countBy
slides.countBy("meta.missing")

// @ts-expect-error where values must match the resolved nested path type
slides.where("meta.enabled", "yes")

// @ts-expect-error whereIn values must match the resolved nested path type
slides.whereIn("meta.score", ["high"])

// @ts-expect-error get only accepts known literal definition keys
slides.get("missing")

// @ts-expect-error createCollection definitions must contain object items
createCollection({ invalid: 1 })

// @ts-expect-error collect does not accept arbitrary primitive strings as collection sources
collect("abc")

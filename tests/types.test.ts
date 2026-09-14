import {
    Collection,
    collect,
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
const objectAlpha = objectCollection.get("alpha")
const objectBeta = objectCollection.get("beta")
type _ObjectAlphaGet = Expect<Equal<typeof objectAlpha, 1 | undefined>>
type _ObjectBetaGet = Expect<Equal<typeof objectBeta, "two" | undefined>>
type _ObjectAlphaProperty = Expect<Equal<ReturnType<typeof objectCollection.toObject>["alpha"], 1>>
type _ObjectBetaProperty = Expect<Equal<ReturnType<typeof objectCollection.toObject>["beta"], "two">>

const runtimeRegistry = collect({
    google: { label: "Google" },
    github: { label: "GitHub" },
} as const)
type _RuntimeRegistryKeys = Expect<Equal<ReturnType<typeof runtimeRegistry.keys>[number], "google" | "github">>
const google = runtimeRegistry.get("google")
type _GoogleLabel = Expect<Equal<NonNullable<typeof google>["label"], "Google">>
type _GithubObjectLabel = Expect<Equal<ReturnType<typeof runtimeRegistry.toObject>["github"]["label"], "GitHub">>

// Object keys never become Collection instance properties.
// @ts-expect-error object-style access is explicit through toObject()
runtimeRegistry.google
// @ts-expect-error collect() never synthesizes an id field
runtimeRegistry.get("google")?.id
// @ts-expect-error get() only accepts known literal object keys
runtimeRegistry.get("missing")

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

const existing = collect({ alpha: { value: 1 as const } })
const same = collect(existing)
type _Existing = Expect<Equal<typeof same, typeof existing>>
type _ExistingObjectShape = Expect<Equal<ReturnType<typeof same.toObject>["alpha"]["value"], 1>>

const numericObjectCollection = collect({
    1: "one",
    alpha: "alpha",
    [Symbol("ignored")]: "symbol",
} as const)
type _NumericObjectKeys = Expect<Equal<
    ReturnType<typeof numericObjectCollection.keys>[number],
    "1" | "alpha"
>>
type _NumericObjectValue = Expect<Equal<ReturnType<typeof numericObjectCollection.toObject>["1"], "one">>
// @ts-expect-error object numeric keys are normalized to strings by Object.entries()
numericObjectCollection.get(1)
numericObjectCollection.get("1")

// ---------------------------------------------------------------------------
// object-source key/value correlation
// ---------------------------------------------------------------------------

const slides = collect({
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

type Slide = ReturnType<typeof slides.items>[number]
type _Keys = Expect<Equal<ReturnType<typeof slides.keys>[number], "canvas" | "security" | "map">>
type _MapRemainsMethod = Expect<Equal<typeof slides.map extends (...args: any[]) => any ? true : false, true>>

type _CanvasObjectTitle = Expect<Equal<ReturnType<typeof slides.toObject>["canvas"]["title"], "Canvas">>
type _MapObjectTitle = Expect<Equal<ReturnType<typeof slides.toObject>["map"]["title"], "Map">>

const security = slides.get("security")
type _ExactGetTitle = Expect<Equal<NonNullable<typeof security>["title"], "Security">>
type _ExactGetScore = Expect<Equal<NonNullable<typeof security>["meta"]["score"], 20>>

// Collection values remain exactly the values supplied by the source.
const suppliedId = collect({
    primary: {
        id: "source-id" as const,
        label: "Primary" as const,
    },
})
const primary = suppliedId.get("primary")
type _SuppliedIdIsUntouched = Expect<Equal<NonNullable<typeof primary>["id"], "source-id">>

const collisionSource = collect({
    map: { label: "Map item" as const },
    filter: { label: "Filter item" as const },
    constructor: { label: "Constructor item" as const },
})
const mapItem = collisionSource.get("map")
type _CollisionGet = Expect<Equal<NonNullable<typeof mapItem>["label"], "Map item">>
type _CollisionObject = Expect<Equal<ReturnType<typeof collisionSource.toObject>["filter"]["label"], "Filter item">>

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

const pairMapped = slides.mapWithKeys((slide, key) => [key, slide.title.length] as const)
type _MapWithKeysKeys = Expect<Equal<ReturnType<typeof pairMapped.keys>[number], "canvas" | "security" | "map">>
type _MapWithKeysValues = Expect<Equal<ReturnType<typeof pairMapped.items>[number], number>>

const flatMapped = collect([1, 2] as const).flatMap((value) => [String(value)])
type _FlatMap = Expect<Equal<typeof flatMapped, Collection<number, string>>>

const collapsed = collect([[1, 2], [3]] as const).collapse()
type _CollapseKeys = Expect<Equal<ReturnType<typeof collapsed.keys>[number], number>>
type _CollapseValues = Expect<Equal<ReturnType<typeof collapsed.items>[number], 1 | 2 | 3>>

const valuesCollection = slides.values()
type _ValuesKeys = Expect<Equal<ReturnType<typeof valuesCollection.keys>[number], number>>
type _ValuesItems = Expect<Equal<ReturnType<typeof valuesCollection.items>[number], Slide>>

const prepended = slides.prepend({ title: "Intro" as const, meta: { enabled: true as const, score: 0 as const } })
type _PrependKeys = Expect<Equal<ReturnType<typeof prepended.keys>[number], number>>
type _PrependTitle = Expect<Equal<ReturnType<typeof prepended.items>[number]["title"], Slide["title"] | "Intro">>

// ---------------------------------------------------------------------------
// nested paths
// ---------------------------------------------------------------------------

const emails = collect({
    ada: { profile: { email: "ada@example.com", score: 10 } },
    grace: { profile: { email: "grace@example.com", score: 20 } },
}).pluck("profile.email")
type _Pluck = Expect<Equal<ReturnType<typeof emails.items>[number], "ada@example.com" | "grace@example.com">>

const keyed = slides.keyBy("title")
type _KeyBy = Expect<Equal<ReturnType<typeof keyed.keys>[number], "Canvas" | "Security" | "Map">>

const grouped = slides.groupBy("meta.enabled")
type _GroupBy = Expect<Equal<ReturnType<typeof grouped.keys>[number], boolean>>
type _GroupValue = Expect<Extends<ReturnType<typeof grouped.items>[number], Collection<"canvas" | "security" | "map", Slide>>>

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
type _AppendValues = Expect<Equal<ReturnType<typeof appended.items>[number], Slide | "end">>

const zipped = collect([1, 2] as const).zip(["a", "b"])
type _Zip = Expect<Equal<ReturnType<typeof zipped.items>[number], readonly [1 | 2 | undefined, string | undefined]>>

const crossed = collect([1, 2] as const).crossJoin(["a", "b"])
type _CrossJoin = Expect<Equal<ReturnType<typeof crossed.items>[number], readonly [1 | 2, string]>>

const partitioned = slides.partition((slide) => slide.meta.enabled)
type _PartitionFirst = Expect<Equal<typeof partitioned[0], Collection<"canvas" | "security" | "map", Slide>>>
type _PartitionSecond = Expect<Equal<typeof partitioned[1], Collection<"canvas" | "security" | "map", Slide>>>

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

// @ts-expect-error object keys are not Collection instance properties
slides.canvas

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

// @ts-expect-error get only accepts known literal object keys
slides.get("missing")

// @ts-expect-error collect does not accept arbitrary primitive strings as collection sources
collect("abc")

// ---------------------------------------------------------------------------
// numeric object keys and recursive paths
// ---------------------------------------------------------------------------

const numericDefinitions = collect({
    1: { label: "One" },
    42: { label: "Forty two" },
})
type _NumericDefinitionKeys = Expect<Equal<
    ReturnType<typeof numericDefinitions.keys>[number],
    "1" | "42"
>>
type _NumericDefinitionLabel = Expect<Equal<ReturnType<typeof numericDefinitions.toObject>["1"]["label"], "One">>
// @ts-expect-error numeric source keys are normalized to their JavaScript string form
numericDefinitions.get(1)

interface RecursiveNode {
    name: string
    child?: RecursiveNode
}

const recursiveNodes = collect([] as RecursiveNode[])
recursiveNodes.pluck("child.child.child.name")
recursiveNodes.where("child.child.name", "nested")
// The bounded path budget prevents circular type expansion while still
// supporting practical nested models.
// @ts-expect-error nested path inference intentionally stops after eight segments
recursiveNodes.pluck("child.child.child.child.child.child.child.child.name")

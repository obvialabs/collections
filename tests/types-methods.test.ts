import {
    Collection,
    collect,
    createCollection,
} from "../src/index"

type Equal<TLeft, TRight> =
    (<T>() => T extends TLeft ? 1 : 2) extends
    (<T>() => T extends TRight ? 1 : 2)
        ? true
        : false

type Expect<TValue extends true> = TValue

const keyed = collect(new Map<"a" | "b", number>([
    ["a", 1],
    ["b", 2],
]))

// State and extraction.
type _Count = Expect<Equal<ReturnType<typeof keyed.count>, number>>
type _Empty = Expect<Equal<ReturnType<typeof keyed.empty>, boolean>>
type _NotEmpty = Expect<Equal<ReturnType<typeof keyed.notEmpty>, boolean>>
type _Items = Expect<Equal<ReturnType<typeof keyed.items>, readonly number[]>>
type _All = Expect<Equal<ReturnType<typeof keyed.all>, readonly number[]>>
type _Keys = Expect<Equal<ReturnType<typeof keyed.keys>, readonly ("a" | "b")[]>>
type _Entries = Expect<Equal<ReturnType<typeof keyed.entries>, readonly (readonly ["a" | "b", number])[]>>
type _ToArray = Expect<Equal<ReturnType<typeof keyed.toArray>, number[]>>
type _ToMap = Expect<Equal<ReturnType<typeof keyed.toMap>, ReadonlyMap<"a" | "b", number>>>
type _ToObject = Expect<Equal<ReturnType<typeof keyed.toObject>, Record<PropertyKey, number>>>

// Access and selection.
const get = keyed.get("a")
type _Get = Expect<Equal<typeof get, number | undefined>>
const getOr = keyed.getOr("a", 0)
type _GetOr = Expect<Equal<typeof getOr, number>>
type _Has = Expect<Equal<ReturnType<typeof keyed.has>, boolean>>
type _HasAny = Expect<Equal<ReturnType<typeof keyed.hasAny>, boolean>>
type _HasAll = Expect<Equal<ReturnType<typeof keyed.hasAll>, boolean>>
const searched = keyed.search((value) => value > 0)
type _Search = Expect<Equal<typeof searched, "a" | "b" | undefined>>
const first = keyed.first()
type _First = Expect<Equal<typeof first, number | undefined>>
const firstOrFail = keyed.firstOrFail()
type _FirstOrFail = Expect<Equal<typeof firstOrFail, number>>
const last = keyed.last()
type _Last = Expect<Equal<typeof last, number | undefined>>
const lastOrFail = keyed.lastOrFail()
type _LastOrFail = Expect<Equal<typeof lastOrFail, number>>
const sole = keyed.sole((value) => value === 1)
type _Sole = Expect<Equal<typeof sole, number>>
const nth = keyed.nth(2)
type _Nth = Expect<Equal<typeof nth, Collection<"a" | "b", number>>>
const randomOne = keyed.random()
type _RandomOne = Expect<Equal<typeof randomOne, number | undefined>>
const randomMany = keyed.random(1)
type _RandomMany = Expect<Equal<typeof randomMany, Collection<number, number>>>

// Transformations and filtering.
const flattened = collect([[1], [2]]).flatten()
type _Flatten = Expect<Equal<typeof flattened, Collection<number, unknown>>>
const rejected = keyed.reject((value) => value === 1)
type _Reject = Expect<Equal<typeof rejected, Collection<"a" | "b", number>>>
const contains = keyed.contains(1)
type _Contains = Expect<Equal<typeof contains, boolean>>
const doesntContain = keyed.doesntContain(3)
type _DoesntContain = Expect<Equal<typeof doesntContain, boolean>>
type _Every = Expect<Equal<ReturnType<typeof keyed.every>, boolean>>
type _Some = Expect<Equal<ReturnType<typeof keyed.some>, boolean>>

// Subsets and windows.
const only = keyed.only(["a"])
type _Only = Expect<Equal<typeof only, Collection<"a" | "b", number>>>
const except = keyed.except(["b"])
type _Except = Expect<Equal<typeof except, Collection<"a" | "b", number>>>
const take = keyed.take(1)
type _Take = Expect<Equal<typeof take, Collection<"a" | "b", number>>>
const skip = keyed.skip(1)
type _Skip = Expect<Equal<typeof skip, Collection<"a" | "b", number>>>
const slice = keyed.slice(0, 1)
type _Slice = Expect<Equal<typeof slice, Collection<"a" | "b", number>>>
const takeUntil = keyed.takeUntil((value) => value === 2)
type _TakeUntil = Expect<Equal<typeof takeUntil, Collection<"a" | "b", number>>>
const takeWhile = keyed.takeWhile((value) => value < 2)
type _TakeWhile = Expect<Equal<typeof takeWhile, Collection<"a" | "b", number>>>
const skipUntil = keyed.skipUntil((value) => value === 2)
type _SkipUntil = Expect<Equal<typeof skipUntil, Collection<"a" | "b", number>>>
const skipWhile = keyed.skipWhile((value) => value < 2)
type _SkipWhile = Expect<Equal<typeof skipWhile, Collection<"a" | "b", number>>>
const chunk = keyed.chunk(1)
type _Chunk = Expect<Equal<typeof chunk, Collection<number, Collection<"a" | "b", number>>>>
const sliding = keyed.sliding(1)
type _Sliding = Expect<Equal<typeof sliding, Collection<number, Collection<"a" | "b", number>>>>
const split = keyed.split(2)
type _Split = Expect<Equal<typeof split, Collection<number, Collection<"a" | "b", number>>>>
const padded = keyed.pad(4, "x" as const)
type _Pad = Expect<Equal<typeof padded, Collection<number, number | "x">>>
const partition = keyed.partition((value) => value > 1)
type _Partition = Expect<Equal<typeof partition, readonly [Collection<"a" | "b", number>, Collection<"a" | "b", number>]>>

// Ordering.
const reversed = keyed.reverse()
type _Reverse = Expect<Equal<typeof reversed, Collection<"a" | "b", number>>>
const shuffled = keyed.shuffle()
type _Shuffle = Expect<Equal<typeof shuffled, Collection<"a" | "b", number>>>
const sorted = keyed.sort((left, right) => left - right)
type _Sort = Expect<Equal<typeof sorted, Collection<"a" | "b", number>>>
const sortByDesc = keyed.sortByDesc((value) => value)
type _SortByDesc = Expect<Equal<typeof sortByDesc, Collection<"a" | "b", number>>>
const sortKeys = keyed.sortKeys()
type _SortKeys = Expect<Equal<typeof sortKeys, Collection<"a" | "b", number>>>
const sortKeysDesc = keyed.sortKeysDesc()
type _SortKeysDesc = Expect<Equal<typeof sortKeysDesc, Collection<"a" | "b", number>>>

// Set and update operations.
const unique = keyed.unique()
type _Unique = Expect<Equal<typeof unique, Collection<"a" | "b", number>>>
const duplicates = keyed.duplicates()
type _Duplicates = Expect<Equal<typeof duplicates, Collection<"a" | "b", number>>>
const diff = keyed.diff([1])
type _Diff = Expect<Equal<typeof diff, Collection<"a" | "b", number>>>
const intersect = keyed.intersect([1])
type _Intersect = Expect<Equal<typeof intersect, Collection<"a" | "b", number>>>
const diffKeys = keyed.diffKeys(["a"])
type _DiffKeys = Expect<Equal<typeof diffKeys, Collection<"a" | "b", number>>>
const intersectByKeys = keyed.intersectByKeys(["a"])
type _IntersectByKeys = Expect<Equal<typeof intersectByKeys, Collection<"a" | "b", number>>>
const union = keyed.union([["a", 10]] as const)
type _Union = Expect<Equal<typeof union, Collection<"a" | "b", number>>>
const replaced = keyed.replace([["a", 10]] as const)
type _Replace = Expect<Equal<typeof replaced, Collection<"a" | "b", number>>>
const removed = keyed.remove("a")
type _Remove = Expect<Equal<typeof removed, Collection<"a" | "b", number>>>

// Flow and aggregates.
const reduced = keyed.reduce((carry, value) => `${carry}${value}`, "")
type _Reduce = Expect<Equal<typeof reduced, string>>
const each = keyed.each(() => undefined)
type _Each = Expect<Equal<typeof each, typeof keyed>>
const tap = keyed.tap(() => undefined)
type _Tap = Expect<Equal<typeof tap, typeof keyed>>
const when = keyed.when(true, (collection) => collection.take(1))
type _When = Expect<Equal<typeof when, Collection<"a" | "b", number>>>
const unless = keyed.unless(false, (collection) => collection.take(1))
type _Unless = Expect<Equal<typeof unless, Collection<"a" | "b", number>>>
type _Sum = Expect<Equal<ReturnType<typeof keyed.sum>, number>>
type _Avg = Expect<Equal<ReturnType<typeof keyed.avg>, number | undefined>>
type _Average = Expect<Equal<ReturnType<typeof keyed.average>, number | undefined>>
const min = keyed.min()
type _Min = Expect<Equal<typeof min, number | undefined>>
const max = keyed.max()
type _Max = Expect<Equal<typeof max, number | undefined>>
type _Median = Expect<Equal<ReturnType<typeof keyed.median>, number | undefined>>
const modes = keyed.mode()
type _Mode = Expect<Equal<typeof modes, readonly number[]>>
type _Join = Expect<Equal<ReturnType<typeof keyed.join>, string>>

const records = collect([
    { state: "ready" as "ready" | "idle", nested: { label: "A" as string | undefined } },
    { state: "idle" as "ready" | "idle", nested: { label: undefined as string | undefined } },
])
const whereNot = records.whereNot("state", "ready")
type _WhereNot = Expect<Equal<typeof whereNot, typeof records>>
const whereNotIn = records.whereNotIn("state", ["idle"])
type _WhereNotIn = Expect<Equal<typeof whereNotIn, typeof records>>
const whereNull = records.whereNull("nested.label")
type _WhereNull = Expect<Equal<typeof whereNull, typeof records>>
const whereNotNull = records.whereNotNull("nested.label")
type _WhereNotNull = Expect<Equal<typeof whereNotNull, typeof records>>
const imploded = records.implode("nested.label", ",")
type _Implode = Expect<Equal<typeof imploded, string>>

const definitions = createCollection({
    canvas: { enabled: true },
    security: { enabled: false },
})
const transformedDefinitions = definitions.filter((item) => item.enabled)
// @ts-expect-error direct definition properties intentionally disappear after transformation
transformedDefinitions.canvas

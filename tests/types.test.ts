import {
    collect,
    createCollection,
    type Collection,
} from "../src/index"

type Equal<TLeft, TRight> =
    (<T>() => T extends TLeft ? 1 : 2) extends
    (<T>() => T extends TRight ? 1 : 2)
        ? true
        : false

type Expect<TValue extends true> = TValue

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

type _CanvasId = Expect<Equal<typeof slides.canvas.id, "canvas">>
type _SecurityTitle = Expect<Equal<typeof slides.security.title, "Security">>
type _Keys = Expect<Equal<ReturnType<typeof slides.keys>[number], "canvas" | "security" | "map">>
type _MapRemainsMethod = Expect<Equal<typeof slides.map extends (...args: any[]) => any ? true : false, true>>

const security = slides.get("security")
type _ExactGet = Expect<Equal<NonNullable<typeof security>["id"], "security">>

const objectCollection = collect({ alpha: 1, beta: "two" } as const)
type _ObjectKeys = Expect<Equal<ReturnType<typeof objectCollection.keys>[number], "alpha" | "beta">>
type _ObjectValues = Expect<Equal<ReturnType<typeof objectCollection.items>[number], 1 | "two">>

const mapCollection = collect(new Map<"a" | "b", number>([["a", 1], ["b", 2]]))
type _MapCollection = Expect<Equal<typeof mapCollection, Collection<"a" | "b", number>>>

const mapped = slides.map((slide) => slide.title.length)
type _MappedKeys = Expect<Equal<ReturnType<typeof mapped.keys>[number], "canvas" | "security" | "map">>
type _MappedValues = Expect<Equal<ReturnType<typeof mapped.items>[number], number>>

const emails = createCollection({
    ada: { profile: { email: "ada@example.com", score: 10 } },
    grace: { profile: { email: "grace@example.com", score: 20 } },
}).pluck("profile.email")
type _Pluck = Expect<Equal<ReturnType<typeof emails.items>[number], "ada@example.com" | "grace@example.com">>

const keyed = slides.keyBy("title")
type _KeyBy = Expect<Equal<ReturnType<typeof keyed.keys>[number], "Canvas" | "Security" | "Map">>

const grouped = slides.groupBy("meta.enabled")
type _GroupBy = Expect<Equal<ReturnType<typeof grouped.keys>[number], boolean>>

const counted = slides.countBy("meta.enabled")
type _CountBy = Expect<Equal<ReturnType<typeof counted.keys>[number], boolean>>

const nullableValues: readonly (number | null)[] = [1, null, 2]
const narrowed = collect(nullableValues).filter(
    (value): value is number => value !== null,
)
type _Narrowed = Expect<Equal<typeof narrowed, Collection<number, number>>>

const flatMapped = collect([1, 2] as const).flatMap((value) => [String(value)])
type _FlatMap = Expect<Equal<typeof flatMapped, Collection<number, string>>>

const merged = collect(new Map<"a", number>([["a", 1]])).merge([["b", "two"]] as const)
type _MergeKeys = Expect<Equal<ReturnType<typeof merged.keys>[number], "a" | "b">>
type _MergeValues = Expect<Equal<ReturnType<typeof merged.items>[number], number | "two">>

const extended = collect([1, 2]).with("total", 3)
type _WithKeys = Expect<Equal<ReturnType<typeof extended.keys>[number], number | string>>

const zipped = collect([1, 2]).zip(["a", "b"])
type _Zip = Expect<Equal<ReturnType<typeof zipped.items>[number], readonly [1 | 2 | undefined, string | undefined]>>

const crossed = collect([1, 2]).crossJoin(["a", "b"])
type _CrossJoin = Expect<Equal<ReturnType<typeof crossed.items>[number], readonly [1 | 2, string]>>

// @ts-expect-error invalid direct collection key
slides.unknown

// @ts-expect-error runtime method collisions are not exposed as direct items
slides.map.title

// @ts-expect-error invalid nested path
slides.pluck("meta.missing")

// @ts-expect-error where values must match the resolved nested path type
slides.where("meta.enabled", "yes")

// @ts-expect-error get only accepts known literal definition keys
slides.get("missing")

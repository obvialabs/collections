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
        meta: { enabled: true },
    },
    security: {
        title: "Security",
        meta: { enabled: false },
    },
    map: {
        title: "Map",
        meta: { enabled: true },
    },
})

type _CanvasId = Expect<Equal<typeof slides.canvas.id, "canvas">>
type _SecurityTitle = Expect<Equal<typeof slides.security.title, "Security">>
type _Keys = Expect<Equal<ReturnType<typeof slides.keys>[number], "canvas" | "security" | "map">>

const security = slides.get("security")
type _ExactGet = Expect<Equal<NonNullable<typeof security>["id"], "security">>

const emails = createCollection({
    ada: { profile: { email: "ada@example.com", score: 10 } },
    grace: { profile: { email: "grace@example.com", score: 20 } },
}).pluck("profile.email")

type _Pluck = Expect<Equal<ReturnType<typeof emails.items>[number], "ada@example.com" | "grace@example.com">>

const nullableValues: readonly (number | null)[] = [1, null, 2]
const narrowed = collect(nullableValues).filter(
    (value): value is number => value !== null,
)

type _Narrowed = Expect<Equal<typeof narrowed, Collection<number, number>>>

// @ts-expect-error invalid direct collection key
slides.unknown

// @ts-expect-error invalid nested path
slides.pluck("meta.missing")

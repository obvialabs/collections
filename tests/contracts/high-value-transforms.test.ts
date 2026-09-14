import { describe, expect, test } from "bun:test"

import { collect } from "#collections"

describe("high-value transformation contracts", () => {
    test("collapseWithKeys merges keyed nested entry sources and later duplicates win", () => {
        const nested = collect([
            collect(new Map([["a", 1], ["shared", 10]])),
            new Map([["b", 2], ["shared", 20]]),
            [["c", 3]] as const,
        ])

        expect(nested.collapseWithKeys().entries()).toEqual([
            ["a", 1],
            ["shared", 20],
            ["b", 2],
            ["c", 3],
        ])
    })

    test("combine uses source values as keys and requires cardinalities to match", () => {
        expect(collect(["name", "age"]).combine(["Ada", 37]).entries()).toEqual([
            ["name", "Ada"],
            ["age", 37],
        ])

        expect(collect(["x", "x"]).combine([1, 2]).entries()).toEqual([["x", 2]])
        expect(() => collect(["a", "b"]).combine([1])).toThrow(RangeError)
        expect(() => collect(["a"]).combine([1, 2])).toThrow(RangeError)
    })

    test("concat appends values, ignores source keys and does not mutate either source", () => {
        const left = collect(new Map< string | number, number>([
            ["named", 10],
            [2, 20],
        ]))
        const right = collect(new Map([
            ["x", 30],
            ["y", 40],
        ]))

        const result = left.concat(right).concat(new Map([["z", 50]])).concat([60])

        expect(result.entries()).toEqual([
            ["named", 10],
            [2, 20],
            [3, 30],
            [4, 40],
            [5, 50],
            [6, 60],
        ])
        expect(left.entries()).toEqual([["named", 10], [2, 20]])
        expect(right.entries()).toEqual([["x", 30], ["y", 40]])
    })

    test("flip swaps values and keys with Map last-write duplicate semantics", () => {
        const source = collect(new Map([
            ["first", "shared"],
            ["second", "unique"],
            ["third", "shared"],
        ]))

        expect(source.flip().entries()).toEqual([
            ["shared", "third"],
            ["unique", "second"],
        ])
    })

    test("mapInto constructs one class instance per entry with value and key", () => {
        class Wrapped {
            public constructor(
                public readonly value: number,
                public readonly key: string,
            ) {}
        }

        const source = collect(new Map([["a", 1], ["b", 2]]))
        const mapped = source.mapInto(Wrapped)

        expect(mapped.get("a")).toBeInstanceOf(Wrapped)
        expect(mapped.get("a")).toEqual(new Wrapped(1, "a"))
        expect(mapped.get("b")).toEqual(new Wrapped(2, "b"))
        expect(source.items()).toEqual([1, 2])
    })

    test("mapSpread spreads tuple items and appends the original key", () => {
        const source = collect(new Map<string, readonly [number, number]>([
            ["a", [1, 2]],
            ["b", [3, 4]],
        ]))

        expect(source.mapSpread((left, right, key) => `${key}:${left + right}`).entries()).toEqual([
            ["a", "a:3"],
            ["b", "b:7"],
        ])
    })

    test("mapToGroups groups mapped values under callback keys with numeric group keys", () => {
        const people = collect([
            { name: "Ada", department: "engineering" },
            { name: "Grace", department: "engineering" },
            { name: "Linus", department: "platform" },
        ])

        const grouped = people.mapToGroups((person) => [person.department, person.name] as const)

        expect(grouped.get("engineering")?.entries()).toEqual([[0, "Ada"], [1, "Grace"]])
        expect(grouped.get("platform")?.entries()).toEqual([[0, "Linus"]])
    })

    test("multiply repeats only values, reindexes numerically and handles zero", () => {
        const source = collect(new Map([["a", 1], ["b", 2]]))

        expect(source.multiply(0).empty()).toBe(true)
        expect(source.multiply(3).entries()).toEqual([
            [0, 1], [1, 2],
            [2, 1], [3, 2],
            [4, 1], [5, 2],
        ])
        expect(source.entries()).toEqual([["a", 1], ["b", 2]])
    })

    test("select projects only requested top-level properties and preserves collection keys", () => {
        const source = collect(new Map([
            ["ada", { name: "Ada", age: 37, active: true }],
            ["grace", { name: "Grace", age: 45, active: false }],
        ]))

        expect(source.select("name").entries()).toEqual([
            ["ada", { name: "Ada" }],
            ["grace", { name: "Grace" }],
        ])
        expect(source.select(["name", "active"] as const).entries()).toEqual([
            ["ada", { name: "Ada", active: true }],
            ["grace", { name: "Grace", active: false }],
        ])
        expect(source.items()[0]).toEqual({ name: "Ada", age: 37, active: true })
    })

    test("dot flattens nested records, arrays, maps and collections with controllable depth", () => {
        const source = collect({
            user: {
                profile: { name: "Ada", active: true },
                tags: ["math", "compiler"],
            },
            settings: new Map([["theme", "dark"]]),
        })

        expect(source.dot(0).keys()).toEqual(["user", "settings"])
        expect(source.dot(1).entries()).toEqual([
            ["user.profile", { name: "Ada", active: true }],
            ["user.tags", ["math", "compiler"]],
            ["settings.theme", "dark"],
        ])
        expect(source.dot().entries()).toEqual([
            ["user.profile.name", "Ada"],
            ["user.profile.active", true],
            ["user.tags.0", "math"],
            ["user.tags.1", "compiler"],
            ["settings.theme", "dark"],
        ])
    })

    test("dot keeps empty containers as terminal values", () => {
        const source = collect({ emptyObject: {}, emptyArray: [] as unknown[] })

        expect(source.dot().entries()).toEqual([
            ["emptyObject", {}],
            ["emptyArray", []],
        ])
    })

    test("undot expands paths and dot/undot preserve flattened semantics", () => {
        const dotted = collect(new Map<string, string | boolean>([
            ["user.profile.name", "Ada"],
            ["user.profile.active", true],
            ["settings.theme", "dark"],
        ]))
        const expanded = dotted.undot()

        expect((expanded.get("user") as any).profile.name).toBe("Ada")
        expect((expanded.get("user") as any).profile.active).toBe(true)
        expect((expanded.get("settings") as any).theme).toBe("dark")
        expect(expanded.dot().entries()).toEqual(dotted.entries())
    })
})

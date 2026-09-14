import { describe, expect, test } from "bun:test"

import { Collection, collect } from "../../dist/index.js"

describe("transformation and filtering contracts", () => {
    test("map preserves keys and provides value, key and the source collection", () => {
        const source = collect(new Map([
            ["a", 2],
            ["b", 4],
        ]))
        const seen: Array<readonly [number, string, boolean]> = []
        const mapped = source.map((value, key, collection) => {
            seen.push([value, key, collection === source] as const)
            return value * 10
        })

        expect(mapped.entries()).toEqual([
            ["a", 20],
            ["b", 40],
        ])
        expect(seen).toEqual([
            [2, "a", true],
            [4, "b", true],
        ])
        expect(source.items()).toEqual([2, 4])
    })

    test("mapValues is behaviorally equivalent to map", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
        ]))

        expect(source.mapValues((value, key) => `${key}:${value}`).entries()).toEqual(
            source.map((value, key) => `${key}:${value}`).entries(),
        )
    })

    test("mapKeys replaces keys and duplicate mapped keys use Map last-value semantics", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
        ]))
        const mapped = source.mapKeys((value) => value % 2)

        expect(mapped.entries()).toEqual([
            [1, 3],
            [0, 2],
        ])
    })

    test("mapWithKeys can replace both key and value in one pass", () => {
        const source = collect(new Map([
            ["a", 2],
            ["b", 3],
        ]))

        expect(source.mapWithKeys((value, key) => [key.toUpperCase(), value ** 2] as const).entries()).toEqual([
            ["A", 4],
            ["B", 9],
        ])
    })

    test("flatMap flattens exactly the iterable returned for each source item and reindexes", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
        ]))
        const visited: string[] = []
        const result = source.flatMap((value, key, collection) => {
            expect(collection).toBe(source)
            visited.push(key)
            return [value, value * 10]
        })

        expect(visited).toEqual(["a", "b"])
        expect(result.entries()).toEqual([
            [0, 1],
            [1, 10],
            [2, 2],
            [3, 20],
        ])
    })

    test("flatten honors depth, treats strings as atomic and supports arbitrary iterables", () => {
        const source = collect([
            [1, [2, 3]],
            new Set([4, 5]),
            "six",
        ] as const)

        expect(source.flatten(0).items()).toEqual(source.items())
        expect(source.flatten(1).items()).toEqual([1, [2, 3], 4, 5, "six"])
        expect(source.flatten(2).items()).toEqual([1, 2, 3, 4, 5, "six"])
        expect(source.flatten().items()).toEqual([1, 2, 3, 4, 5, "six"])
    })

    test("flattening a Map follows its iterable entry representation", () => {
        const source = collect([new Map([["a", 1], ["b", 2]])])

        expect(source.flatten(1).items()).toEqual([
            ["a", 1],
            ["b", 2],
        ])
        expect(source.flatten(2).items()).toEqual(["a", 1, "b", 2])
    })

    test("collapse is flatten(1) with numeric reindexing", () => {
        const source = collect([[1, 2], [3], []] as const)

        expect(source.collapse().entries()).toEqual([
            [0, 1],
            [1, 2],
            [2, 3],
        ])
        expect(source.collapse().entries()).toEqual(source.flatten(1).entries())
    })

    test("pluck resolves typed nested paths while preserving source keys", () => {
        const users = collect({
            ada: { profile: { email: "ada@example.com", active: true } },
            grace: { profile: { email: "grace@example.com", active: false } },
        })

        expect(users.pluck("profile.email").entries()).toEqual([
            ["ada", "ada@example.com"],
            ["grace", "grace@example.com"],
        ])
    })

    test("nested path access returns undefined when an optional intermediate value is missing", () => {
        const users = collect([
            { profile: { email: "ada@example.com" } } as { profile?: { email: string } },
            {} as { profile?: { email: string } },
        ])

        expect(users.pluck("profile.email").items()).toEqual([
            "ada@example.com",
            undefined,
        ])
    })

    test("keyBy supports nested paths and callbacks and duplicate keys keep the last value", () => {
        const users = collect([
            { id: 1, profile: { email: "same@example.com" } },
            { id: 2, profile: { email: "other@example.com" } },
            { id: 3, profile: { email: "same@example.com" } },
        ])

        expect(users.keyBy("profile.email").entries()).toEqual([
            ["same@example.com", { id: 3, profile: { email: "same@example.com" } }],
            ["other@example.com", { id: 2, profile: { email: "other@example.com" } }],
        ])
        expect(users.keyBy((user) => user.id).keys()).toEqual([1, 2, 3])
    })

    test("filter preserves original keys and reject returns its exact complement", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
            ["d", 4],
        ]))
        const accepted = source.filter((value) => value % 2 === 0)
        const rejected = source.reject((value) => value % 2 === 0)

        expect(accepted.entries()).toEqual([
            ["b", 2],
            ["d", 4],
        ])
        expect(rejected.entries()).toEqual([
            ["a", 1],
            ["c", 3],
        ])
        expect([...accepted.keys(), ...rejected.keys()].sort()).toEqual(source.keys())
    })

    test("filter and reject callbacks receive the original collection instance", () => {
        const source = collect([1, 2])
        const filterCollections: Array<typeof source> = []
        const rejectCollections: Array<typeof source> = []

        source.filter((_, __, collection) => {
            filterCollections.push(collection)
            return true
        })
        source.reject((_, __, collection) => {
            rejectCollections.push(collection)
            return false
        })

        expect(filterCollections).toEqual([source, source])
        expect(rejectCollections).toEqual([source, source])
    })

    test("where and whereNot use Object.is semantics", () => {
        const values = collect([
            { value: Number.NaN },
            { value: 0 },
            { value: -0 },
        ])

        expect(values.where("value", Number.NaN).keys()).toEqual([0])
        expect(values.where("value", 0).keys()).toEqual([1])
        expect(values.where("value", -0).keys()).toEqual([2])
        expect(values.whereNot("value", 0).keys()).toEqual([0, 2])
    })

    test("whereIn and whereNotIn use Set membership semantics", () => {
        const values = collect([
            { value: Number.NaN },
            { value: 0 },
            { value: -0 },
            { value: 1 },
        ])

        expect(values.whereIn("value", [Number.NaN, -0]).keys()).toEqual([0, 1, 2])
        expect(values.whereNotIn("value", [Number.NaN, 0]).keys()).toEqual([3])
    })

    test("whereNull and whereNotNull distinguish nullish values from other falsy values", () => {
        const values = collect([
            { value: null as null | undefined | false | 0 | "" },
            { value: undefined as null | undefined | false | 0 | "" },
            { value: false as null | undefined | false | 0 | "" },
            { value: 0 as null | undefined | false | 0 | "" },
            { value: "" as null | undefined | false | 0 | "" },
        ])

        expect(values.whereNull("value").keys()).toEqual([0, 1])
        expect(values.whereNotNull("value").keys()).toEqual([2, 3, 4])
    })

    test("contains and doesntContain use Object.is for values and short-circuit predicates", () => {
        const values = collect([Number.NaN, 0, -0, 4])
        const visited: number[] = []

        expect(values.contains(Number.NaN)).toBe(true)
        expect(values.contains(0)).toBe(true)
        expect(values.doesntContain(7)).toBe(true)
        expect(values.contains((value) => {
            visited.push(value)
            return Object.is(value, -0)
        })).toBe(true)
        expect(visited.length).toBe(3)
    })

    test("function values must be searched with a predicate because a function argument is a predicate", () => {
        const callback = () => "value"
        const values = collect([callback])

        expect(values.contains((value: typeof callback) => value === callback)).toBe(true)
        expect(values.doesntContain((value: typeof callback) => value === callback)).toBe(false)
    })

    test("every and some have standard empty semantics and stop as soon as the result is known", () => {
        const empty = collect([] as number[])
        const values = collect([1, 2, 3, 4])
        const everyVisited: number[] = []
        const someVisited: number[] = []

        expect(empty.every(() => false)).toBe(true)
        expect(empty.some(() => true)).toBe(false)
        expect(values.every((value) => {
            everyVisited.push(value)
            return value < 3
        })).toBe(false)
        expect(values.some((value) => {
            someVisited.push(value)
            return value === 2
        })).toBe(true)
        expect(everyVisited).toEqual([1, 2, 3])
        expect(someVisited).toEqual([1, 2])
    })
})

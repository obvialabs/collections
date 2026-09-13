import { describe, expect, test } from "bun:test"

import { collect } from "../../dist/index.js"

describe("ordering and grouping contracts", () => {
    test("reverse changes iteration order while preserving key/value associations", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
        ]))

        expect(source.reverse().entries()).toEqual([
            ["c", 3],
            ["b", 2],
            ["a", 1],
        ])
        expect(source.reverse().reverse().entries()).toEqual(source.entries())
    })

    test("shuffle preserves cardinality and every key/value association", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
            ["d", 4],
            ["e", 5],
        ]))

        for (let attempt = 0; attempt < 20; attempt += 1) {
            const shuffled = source.shuffle()
            const normalized = shuffled.entries().slice().sort(([left], [right]) => left.localeCompare(right))

            expect(shuffled.count()).toBe(source.count())
            expect(normalized).toEqual(source.entries())
        }
    })

    test("sort passes values and original keys to the comparator", () => {
        const source = collect(new Map([
            ["high", 3],
            ["low", 1],
            ["middle", 2],
        ]))
        const seenKeys = new Set<string>()

        const sorted = source.sort((left, right, leftKey, rightKey) => {
            seenKeys.add(leftKey)
            seenKeys.add(rightKey)
            return left - right
        })

        expect(sorted.entries()).toEqual([
            ["low", 1],
            ["middle", 2],
            ["high", 3],
        ])
        expect([...seenKeys].sort()).toEqual(["high", "low", "middle"])
    })

    test("sort is stable when comparator results are equal", () => {
        const source = collect(new Map([
            ["first", { rank: 1, id: "a" }],
            ["second", { rank: 1, id: "b" }],
            ["third", { rank: 1, id: "c" }],
        ]))

        expect(source.sort(() => 0).keys()).toEqual(["first", "second", "third"])
    })

    test("sortBy supports paths and callbacks while keeping ties stable", () => {
        const source = collect(new Map([
            ["a", { score: 2, profile: { name: "Beta" } }],
            ["b", { score: 1, profile: { name: "Alpha" } }],
            ["c", { score: 1, profile: { name: "Gamma" } }],
        ]))

        expect(source.sortBy("score").keys()).toEqual(["b", "c", "a"])
        expect(source.sortBy((value) => value.profile.name).keys()).toEqual(["b", "a", "c"])
    })

    test("sortByDesc reverses ordering but preserves relative order of equal values", () => {
        const source = collect(new Map([
            ["a", { score: 1 }],
            ["b", { score: 2 }],
            ["c", { score: 2 }],
            ["d", { score: 1 }],
        ]))

        expect(source.sortByDesc("score").keys()).toEqual(["b", "c", "a", "d"])
    })

    test("sortBy has deterministic nullish ordering", () => {
        const source = collect(new Map([
            ["number", { value: 1 as number | null | undefined }],
            ["undefined", { value: undefined as number | null | undefined }],
            ["null", { value: null as number | null | undefined }],
            ["zero", { value: 0 as number | null | undefined }],
        ]))

        expect(source.sortBy("value").keys()).toEqual(["null", "undefined", "zero", "number"])
        expect(source.sortByDesc("value").keys()).toEqual(["number", "zero", "undefined", "null"])
    })

    test("sortBy compares bigint, Date and string selector results", () => {
        expect(collect([3n, 1n, 2n]).sortBy((value) => value).items()).toEqual([1n, 2n, 3n])

        const dates = [
            new Date("2026-03-01T00:00:00Z"),
            new Date("2025-01-01T00:00:00Z"),
            new Date("2026-01-01T00:00:00Z"),
        ]
        expect(collect(dates).sortBy((value) => value).items()).toEqual([
            dates[1],
            dates[2],
            dates[0],
        ])
        expect(collect(["gamma", "alpha", "beta"]).sortBy((value) => value).items()).toEqual([
            "alpha",
            "beta",
            "gamma",
        ])
    })

    test("sortKeys and sortKeysDesc preserve values and use deterministic key ordering", () => {
        const source = collect(new Map([
            ["c", 3],
            ["a", 1],
            ["b", 2],
        ]))

        expect(source.sortKeys().entries()).toEqual([["a", 1], ["b", 2], ["c", 3]])
        expect(source.sortKeysDesc().entries()).toEqual([["c", 3], ["b", 2], ["a", 1]])
    })

    test("groupBy path preserves first-seen group order and original member keys", () => {
        const source = collect(new Map([
            ["a", { team: "blue", score: 1 }],
            ["b", { team: "red", score: 2 }],
            ["c", { team: "blue", score: 3 }],
            ["d", { team: "green", score: 4 }],
        ]))
        const groups = source.groupBy("team")

        expect(groups.keys()).toEqual(["blue", "red", "green"])
        expect(groups.get("blue")?.keys()).toEqual(["a", "c"])
        expect(groups.get("red")?.entries()).toEqual([["b", { team: "red", score: 2 }]])
    })

    test("groupBy callback receives original keys", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
        ]))
        const visited: string[] = []
        const groups = source.groupBy((value, key) => {
            visited.push(key)
            return value % 2 === 0 ? "even" : "odd"
        })

        expect(visited).toEqual(["a", "b", "c"])
        expect(groups.get("odd")?.keys()).toEqual(["a", "c"])
        expect(groups.get("even")?.keys()).toEqual(["b"])
    })

    test("countBy path and callback count every source entry exactly once", () => {
        const source = collect(new Map([
            ["a", { team: "blue" }],
            ["b", { team: "red" }],
            ["c", { team: "blue" }],
        ]))
        let callbackCalls = 0

        expect(source.countBy("team").entries()).toEqual([
            ["blue", 2],
            ["red", 1],
        ])
        expect(source.countBy((value) => {
            callbackCalls += 1
            return value.team
        }).entries()).toEqual([
            ["blue", 2],
            ["red", 1],
        ])
        expect(callbackCalls).toBe(source.count())
    })
})

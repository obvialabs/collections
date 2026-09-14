import { describe, expect, test } from "bun:test"

import { collect } from "../../dist/index.js"

describe("high-value navigation and windowing contracts", () => {
    test("before and after return adjacent values around the first strict match", () => {
        const values = collect([Number.NaN, 0, -0, 4])

        expect(values.before(Number.NaN)).toBeUndefined()
        expect(values.after(Number.NaN)).toBe(0)
        expect(Object.is(values.before(-0), 0)).toBe(true)
        expect(values.after(-0)).toBe(4)
        expect(values.after(4)).toBeUndefined()
        expect(values.before(999)).toBeUndefined()
    })

    test("before and after accept predicates and stop at the first match", () => {
        const source = collect(new Map([
            ["a", 10],
            ["b", 20],
            ["c", 30],
            ["d", 40],
        ]))
        const beforeVisited: string[] = []
        const afterVisited: string[] = []

        expect(source.before((value, key) => {
            beforeVisited.push(key)
            return value === 30
        })).toBe(20)

        expect(source.after((value, key) => {
            afterVisited.push(key)
            return value === 20
        })).toBe(30)

        expect(beforeVisited).toEqual(["a", "b", "c"])
        expect(afterVisited).toEqual(["a", "b"])
    })

    test("firstWhere uses the same Object.is nested-path semantics as where", () => {
        const source = collect([
            { state: "idle", score: Number.NaN },
            { state: "ready", score: 0 },
            { state: "ready", score: -0 },
        ])

        expect(source.firstWhere("state", "ready")).toEqual({ state: "ready", score: 0 })
        expect(source.firstWhere("score", Number.NaN)).toBe(source.get(0))
        expect(Object.is(source.firstWhere("score", -0)?.score, -0)).toBe(true)
        expect(source.firstWhere("state", "missing" as "idle" | "ready")).toBeUndefined()
    })

    test("hasMany and hasSole support whole-collection and predicate cardinality checks", () => {
        expect(collect([] as number[]).hasMany()).toBe(false)
        expect(collect([1]).hasMany()).toBe(false)
        expect(collect([1, 2]).hasMany()).toBe(true)

        expect(collect([] as number[]).hasSole()).toBe(false)
        expect(collect([1]).hasSole()).toBe(true)
        expect(collect([1, 2]).hasSole()).toBe(false)

        const source = collect([1, 2, 3, 4, 5])
        expect(source.hasMany((value) => value % 2 === 0)).toBe(true)
        expect(source.hasMany((value) => value > 4)).toBe(false)
        expect(source.hasSole((value) => value > 4)).toBe(true)
        expect(source.hasSole((value) => value % 2 === 0)).toBe(false)
    })

    test("chunkWhile builds chunks from the previous chunk state and preserves source keys", () => {
        const source = collect(new Map([
            ["a1", "A"],
            ["a2", "A"],
            ["b1", "B"],
            ["b2", "B"],
            ["b3", "B"],
            ["c1", "C"],
        ]))
        const seen: Array<readonly [string, string, readonly string[]]> = []

        const chunks = source.chunkWhile((value, key, chunk) => {
            seen.push([value, key, chunk.keys()] as const)
            return value === chunk.last()
        })

        expect(chunks.items().map((chunk) => chunk.entries())).toEqual([
            [["a1", "A"], ["a2", "A"]],
            [["b1", "B"], ["b2", "B"], ["b3", "B"]],
            [["c1", "C"]],
        ])
        expect(seen).toEqual([
            ["A", "a2", ["a1"]],
            ["B", "b1", ["a1", "a2"]],
            ["B", "b2", ["b1"]],
            ["B", "b3", ["b1", "b2"]],
            ["C", "c1", ["b1", "b2", "b3"]],
        ])
        expect(collect([] as number[]).chunkWhile(() => true).empty()).toBe(true)
    })

    test("forPage uses one-based pages, preserves keys and returns empty beyond the end", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
            ["d", 4],
            ["e", 5],
        ]))

        expect(source.forPage(1, 2).entries()).toEqual([["a", 1], ["b", 2]])
        expect(source.forPage(2, 2).entries()).toEqual([["c", 3], ["d", 4]])
        expect(source.forPage(3, 2).entries()).toEqual([["e", 5]])
        expect(source.forPage(4, 2).empty()).toBe(true)
    })

    test("splitIn fills earlier groups completely instead of balancing remainder items", () => {
        const source = collect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

        expect(source.split(3).items().map((group) => group.items())).toEqual([
            [1, 2, 3, 4],
            [5, 6, 7],
            [8, 9, 10],
        ])
        expect(source.splitIn(3).items().map((group) => group.items())).toEqual([
            [1, 2, 3, 4],
            [5, 6, 7, 8],
            [9, 10],
        ])
        expect(collect([1, 2]).splitIn(5).items().map((group) => group.items())).toEqual([[1], [2]])
        expect(collect([] as number[]).splitIn(3).empty()).toBe(true)
    })
})

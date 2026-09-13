import { describe, expect, test } from "bun:test"

import { collect } from "../../dist/index.js"

describe("subset and window contracts", () => {
    test("only preserves source order rather than requested-key order", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
        ]))

        expect(source.only(["c", "a", "c"]).entries()).toEqual([
            ["a", 1],
            ["c", 3],
        ])
        expect(source.only(["missing" as "a"]).empty()).toBe(true)
    })

    test("except ignores unknown keys and preserves surviving source order", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
        ]))

        expect(source.except(["b"]).entries()).toEqual([
            ["a", 1],
            ["c", 3],
        ])
        expect(source.except(["missing" as "a"]).entries()).toEqual(source.entries())
    })

    test("take handles positive, negative, zero and oversized limits without rekeying", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
        ]))

        expect(source.take(2).entries()).toEqual([["a", 1], ["b", 2]])
        expect(source.take(-2).entries()).toEqual([["b", 2], ["c", 3]])
        expect(source.take(0).empty()).toBe(true)
        expect(source.take(99).entries()).toEqual(source.entries())
        expect(source.take(-99).entries()).toEqual(source.entries())
    })

    test("skip handles positive, negative, zero and oversized counts without rekeying", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
            ["d", 4],
        ]))

        expect(source.skip(2).entries()).toEqual([["c", 3], ["d", 4]])
        expect(source.skip(-2).entries()).toEqual([["a", 1], ["b", 2]])
        expect(source.skip(0).entries()).toEqual(source.entries())
        expect(source.skip(99).empty()).toBe(true)
        expect(source.skip(-99).empty()).toBe(true)
    })

    test("slice normalizes negative offsets and uses length rather than end index", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
            ["d", 4],
            ["e", 5],
        ]))

        expect(source.slice(1, 2).entries()).toEqual([["b", 2], ["c", 3]])
        expect(source.slice(-2, 1).entries()).toEqual([["d", 4]])
        expect(source.slice(-99, 2).entries()).toEqual([["a", 1], ["b", 2]])
        expect(source.slice(99).empty()).toBe(true)
        expect(source.slice(1, 0).empty()).toBe(true)
        expect(source.slice(2).entries()).toEqual([["c", 3], ["d", 4], ["e", 5]])
    })

    test("takeUntil excludes the matching item and avoids evaluating later entries", () => {
        const source = collect([1, 2, 3, 4])
        const visited: number[] = []

        expect(source.takeUntil((value) => {
            visited.push(value)
            return value === 3
        }).items()).toEqual([1, 2])
        expect(visited).toEqual([1, 2, 3])
        expect(source.takeUntil(() => false).items()).toEqual(source.items())
        expect(source.takeUntil(() => true).empty()).toBe(true)
    })

    test("takeWhile excludes the first rejected item and does not inspect later entries", () => {
        const source = collect([1, 2, 3, 4])
        const visited: number[] = []

        expect(source.takeWhile((value) => {
            visited.push(value)
            return value < 3
        }).items()).toEqual([1, 2])
        expect(visited).toEqual([1, 2, 3])
    })

    test("skipUntil includes the first matching item and stops evaluating its predicate afterwards", () => {
        const source = collect([1, 2, 3, 4])
        const visited: number[] = []

        expect(source.skipUntil((value) => {
            visited.push(value)
            return value === 3
        }).items()).toEqual([3, 4])
        expect(visited).toEqual([1, 2, 3])
        expect(source.skipUntil(() => false).empty()).toBe(true)
        expect(source.skipUntil(() => true).items()).toEqual(source.items())
    })

    test("skipWhile includes the first rejected item and never reevaluates later items", () => {
        const source = collect([1, 2, 3, 2])
        const visited: number[] = []

        expect(source.skipWhile((value) => {
            visited.push(value)
            return value < 3
        }).items()).toEqual([3, 2])
        expect(visited).toEqual([1, 2, 3])
    })

    test("chunk preserves original keys inside each chunk and omits empty chunks", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
            ["d", 4],
            ["e", 5],
        ]))

        expect(source.chunk(2).map((chunk) => chunk.entries()).items()).toEqual([
            [["a", 1], ["b", 2]],
            [["c", 3], ["d", 4]],
            [["e", 5]],
        ])
        expect(source.chunk(99).count()).toBe(1)
        expect(collect([] as number[]).chunk(2).empty()).toBe(true)
    })

    test("sliding emits only complete windows and honors step gaps", () => {
        const source = collect([1, 2, 3, 4, 5, 6])

        expect(source.sliding(3).map((window) => window.items()).items()).toEqual([
            [1, 2, 3],
            [2, 3, 4],
            [3, 4, 5],
            [4, 5, 6],
        ])
        expect(source.sliding(2, 3).map((window) => window.items()).items()).toEqual([
            [1, 2],
            [4, 5],
        ])
        expect(source.sliding(7).empty()).toBe(true)
    })

    test("split creates the requested number of balanced groups when possible", () => {
        const source = collect([1, 2, 3, 4, 5])

        expect(source.split(4).map((group) => group.items()).items()).toEqual([
            [1, 2],
            [3],
            [4],
            [5],
        ])
        expect(source.split(99).map((group) => group.items()).items()).toEqual([
            [1], [2], [3], [4], [5],
        ])
        expect(collect([] as number[]).split(3).empty()).toBe(true)
    })

    test("pad right- or left-pads to an absolute size and always returns numeric keys", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
        ]))

        expect(source.pad(4, 0).entries()).toEqual([[0, 1], [1, 2], [2, 0], [3, 0]])
        expect(source.pad(-4, 0).entries()).toEqual([[0, 0], [1, 0], [2, 1], [3, 2]])
        expect(source.pad(1, 0).entries()).toEqual([[0, 1], [1, 2]])
        expect(source.pad(0, 0).entries()).toEqual([[0, 1], [1, 2]])
    })

    test("partition preserves original keys and order in both output collections", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
            ["d", 4],
        ]))
        const visited: string[] = []
        const [even, odd] = source.partition((value, key) => {
            visited.push(key)
            return value % 2 === 0
        })

        expect(even.entries()).toEqual([["b", 2], ["d", 4]])
        expect(odd.entries()).toEqual([["a", 1], ["c", 3]])
        expect(visited).toEqual(["a", "b", "c", "d"])
    })
})

import { describe, expect, test } from "bun:test"

import { collect } from "#collections"

describe("subsets, windows and ordering", () => {
    test("take, skip and slice support both ends without losing keys", () => {
        const values = collect(new Map([["a", 1], ["b", 2], ["c", 3], ["d", 4], ["e", 5]]))

        expect(values.take(2).keys()).toEqual(["a", "b"])
        expect(values.take(-2).keys()).toEqual(["d", "e"])
        expect(values.take(0).empty()).toBe(true)
        expect(values.skip(2).keys()).toEqual(["c", "d", "e"])
        expect(values.skip(-2).keys()).toEqual(["a", "b", "c"])
        expect(values.slice(1, 2).keys()).toEqual(["b", "c"])
        expect(values.slice(-2, 1).keys()).toEqual(["d"])
        expect(values.slice(-99, 2).keys()).toEqual(["a", "b"])
    })

    test("until and while variants stop at the correct boundary", () => {
        const values = collect([1, 2, 3, 4, 5])

        expect(values.takeUntil((value) => value === 3).items()).toEqual([1, 2])
        expect(values.takeWhile((value) => value < 3).items()).toEqual([1, 2])
        expect(values.skipUntil((value) => value === 3).items()).toEqual([3, 4, 5])
        expect(values.skipWhile((value) => value < 3).items()).toEqual([3, 4, 5])
    })

    test("only and except select by key instead of value", () => {
        const values = collect(new Map([["a", 1], ["b", 2], ["c", 3]]))

        expect(values.only(["c", "a"]).entries()).toEqual([["a", 1], ["c", 3]])
        expect(values.except(["b"]).entries()).toEqual([["a", 1], ["c", 3]])
    })

    test("chunk, sliding and split preserve all input items", () => {
        const values = collect([1, 2, 3, 4, 5])

        expect(values.chunk(2).map((chunk) => chunk.items()).items()).toEqual([[1, 2], [3, 4], [5]])
        expect(values.sliding(3).map((window) => window.items()).items()).toEqual([[1, 2, 3], [2, 3, 4], [3, 4, 5]])
        expect(values.sliding(3, 2).map((window) => window.items()).items()).toEqual([[1, 2, 3], [3, 4, 5]])
        expect(values.split(4).map((group) => group.items()).items()).toEqual([[1, 2], [3], [4], [5]])
        expect(values.split(99).count()).toBe(5)
    })

    test("pad and partition create independent numeric/subset collections", () => {
        const values = collect([1, 2, 3])

        expect(values.pad(5, 0).items()).toEqual([1, 2, 3, 0, 0])
        expect(values.pad(-5, 0).items()).toEqual([0, 0, 1, 2, 3])
        expect(values.pad(2, 0).items()).toEqual([1, 2, 3])

        const [odd, even] = values.partition((value) => value % 2 === 1)
        expect(odd.items()).toEqual([1, 3])
        expect(even.items()).toEqual([2])
    })

    test("sorting is stable for ascending and descending equal selectors", () => {
        const values = collect([
            { rank: 1, name: "a" },
            { rank: 2, name: "b" },
            { rank: 2, name: "c" },
            { rank: 1, name: "d" },
        ])

        expect(values.sortBy("rank").pluck("name").items()).toEqual(["a", "d", "b", "c"])
        expect(values.sortByDesc("rank").pluck("name").items()).toEqual(["b", "c", "a", "d"])
        expect(values.sort((left, right) => left.name.localeCompare(right.name)).pluck("name").items()).toEqual(["a", "b", "c", "d"])
    })

    test("key sorting, reverse, shuffle and random preserve membership", () => {
        const values = collect(new Map([["c", 3], ["a", 1], ["b", 2]]))

        expect(values.sortKeys().keys()).toEqual(["a", "b", "c"])
        expect(values.sortKeysDesc().keys()).toEqual(["c", "b", "a"])
        expect(values.reverse().keys()).toEqual(["b", "a", "c"])

        const originalRandom = Math.random
        Math.random = () => 0
        try {
            expect(values.random()).toBe(3)
            expect(values.random(2).count()).toBe(2)
            expect([...values.shuffle().items()].sort()).toEqual([1, 2, 3])
        } finally {
            Math.random = originalRandom
        }
    })
})

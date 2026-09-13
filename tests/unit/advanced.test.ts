import { describe, expect, test } from "bun:test"

import { collect } from "../../dist/index.js"

describe("advanced collection operations", () => {
    test("take and skip predicate variants preserve sequence", () => {
        const values = collect([1, 2, 3, 4, 5])

        expect(values.takeUntil((value) => value === 4).items()).toEqual([1, 2, 3])
        expect(values.takeWhile((value) => value < 4).items()).toEqual([1, 2, 3])
        expect(values.skipUntil((value) => value === 3).items()).toEqual([3, 4, 5])
        expect(values.skipWhile((value) => value < 3).items()).toEqual([3, 4, 5])
    })

    test("chunk, sliding, split and partition return nested collections", () => {
        const values = collect([1, 2, 3, 4, 5])

        expect(values.chunk(2).map((chunk) => chunk.items()).items()).toEqual([[1, 2], [3, 4], [5]])
        expect(values.sliding(3, 2).map((window) => window.items()).items()).toEqual([[1, 2, 3], [3, 4, 5]])
        expect(values.split(2).map((group) => group.items()).items()).toEqual([[1, 2, 3], [4, 5]])

        const [even, odd] = values.partition((value) => value % 2 === 0)
        expect(even.items()).toEqual([2, 4])
        expect(odd.items()).toEqual([1, 3, 5])
    })

    test("set and key-set operations preserve original entries", () => {
        const values = collect(new Map([["a", 1], ["b", 2], ["c", 2]]))

        expect(values.unique().entries()).toEqual([["a", 1], ["b", 2]])
        expect(values.duplicates().entries()).toEqual([["c", 2]])
        expect(values.diff([2]).keys()).toEqual(["a"])
        expect(values.intersect([2]).keys()).toEqual(["b", "c"])
        expect(values.diffKeys(["b"]).keys()).toEqual(["a", "c"])
        expect(values.intersectByKeys(["a", "c"]).keys()).toEqual(["a", "c"])
    })

    test("merge, replace, with and remove are immutable", () => {
        const source = collect(new Map([["a", 1], ["b", 2]]))
        const merged = source.merge([["b", 20], ["c", 30]])

        expect(source.entries()).toEqual([["a", 1], ["b", 2]])
        expect(merged.entries()).toEqual([["a", 1], ["b", 20], ["c", 30]])
        expect(source.replace([["b", 7], ["missing", 9]]).entries()).toEqual([["a", 1], ["b", 7]])
        expect(source.with("c", 3).get("c")).toBe(3)
        expect(source.remove("a").has("a")).toBe(false)
    })

    test("zip, crossJoin and pad produce numeric collections", () => {
        expect(collect([1, 2]).zip(["a"]).items()).toEqual([[1, "a"], [2, undefined]])
        expect(collect([1, 2]).crossJoin(["a", "b"]).items()).toEqual([[1, "a"], [1, "b"], [2, "a"], [2, "b"]])
        expect(collect([1, 2]).pad(4, 0).items()).toEqual([1, 2, 0, 0])
        expect(collect([1, 2]).pad(-4, 0).items()).toEqual([0, 0, 1, 2])
    })

    test("aggregates and string helpers produce native values", () => {
        const values = collect([1, 2, 2, 4])

        expect(values.sum()).toBe(9)
        expect(values.average()).toBe(2.25)
        expect(values.avg()).toBe(2.25)
        expect(values.min()).toBe(1)
        expect(values.max()).toBe(4)
        expect(values.median()).toBe(2)
        expect(values.mode()).toEqual([2])
        expect(values.join(", ", " and ")).toBe("1, 2, 2 and 4")
    })
})

import { describe, expect, test } from "bun:test"

import { collect } from "../../dist/index.js"

describe("set, update and combination contracts", () => {
    test("unique keeps the first entry for each SameValueZero selector result", () => {
        const source = collect(new Map([
            ["nan-a", Number.NaN],
            ["nan-b", Number.NaN],
            ["zero", 0],
            ["negative-zero", -0],
            ["one", 1],
        ]))

        expect(source.unique().keys()).toEqual(["nan-a", "zero", "one"])
    })

    test("unique selector keeps first matching source key and value", () => {
        const source = collect(new Map([
            ["a", { group: 1, id: "a" }],
            ["b", { group: 1, id: "b" }],
            ["c", { group: 2, id: "c" }],
        ]))

        expect(source.unique((value) => value.group).keys()).toEqual(["a", "c"])
    })

    test("duplicates returns every occurrence after the first duplicate value", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 1],
            ["c", 1],
            ["d", 2],
            ["e", 2],
        ]))

        expect(source.duplicates().entries()).toEqual([
            ["b", 1],
            ["c", 1],
            ["e", 2],
        ])
    })

    test("diff and intersect use SameValueZero membership without rekeying", () => {
        const source = collect(new Map<string, number>([
            ["nan", Number.NaN],
            ["zero", 0],
            ["one", 1],
        ]))

        expect(source.intersect([Number.NaN, -0]).keys()).toEqual(["nan", "zero"])
        expect(source.diff([Number.NaN, 0]).keys()).toEqual(["one"])
    })

    test("diffKeys and intersectByKeys operate on key identity only", () => {
        const objectKey = { id: 1 }
        const otherObject = { id: 1 }
        const source = collect(new Map<object, string>([
            [objectKey, "match"],
            [otherObject, "other"],
        ]))

        expect(source.intersectByKeys([objectKey]).entries()).toEqual([[objectKey, "match"]])
        expect(source.diffKeys([objectKey]).entries()).toEqual([[otherObject, "other"]])
    })

    test("union preserves existing values and accepts only the first incoming value for a new duplicate key", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
        ]))
        const result = source.union([
            ["b", 20],
            ["c", 30],
            ["c", 31],
        ])

        expect(result.entries()).toEqual([
            ["a", 1],
            ["b", 2],
            ["c", 30],
        ])
        expect(source.entries()).toEqual([["a", 1], ["b", 2]])
    })

    test("merge overwrites matching keys and later incoming duplicates win", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
        ]))
        const result = source.merge([
            ["b", 20],
            ["c", 30],
            ["c", 31],
        ])

        expect(result.entries()).toEqual([
            ["a", 1],
            ["b", 20],
            ["c", 31],
        ])
    })

    test("replace changes existing keys only and never adds unknown keys", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
        ]))

        expect(source.replace([
            ["b", 20],
            ["missing" as "a", 99],
        ]).entries()).toEqual([
            ["a", 1],
            ["b", 20],
        ])
    })

    test("with replaces in place or appends a new key without mutating the source", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
        ]))

        expect(source.with("a", 10).entries()).toEqual([["a", 10], ["b", 2]])
        expect(source.with("c", 3).entries()).toEqual([["a", 1], ["b", 2], ["c", 3]])
        expect(source.entries()).toEqual([["a", 1], ["b", 2]])
    })

    test("append chooses one greater than the largest numeric key and ignores nonnumeric keys", () => {
        const source = collect(new Map<string | number, string>([
            ["name", "first"],
            [5, "five"],
            [2, "two"],
        ]))

        expect(source.append("next").entries()).toEqual([
            ["name", "first"],
            [5, "five"],
            [2, "two"],
            [6, "next"],
        ])
        expect(collect(new Map([["a", 1]])).append(2).entries()).toEqual([
            ["a", 1],
            [0, 2],
        ])
    })

    test("prepend places the new value first and intentionally reindexes every value", () => {
        const source = collect(new Map([
            ["a", 10],
            ["b", 20],
        ]))

        expect(source.prepend(5).entries()).toEqual([
            [0, 5],
            [1, 10],
            [2, 20],
        ])
    })

    test("remove deletes one key, ignores a missing key and keeps source immutable", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
        ]))

        expect(source.remove("a").entries()).toEqual([["b", 2]])
        expect(source.remove("missing" as "a").entries()).toEqual(source.entries())
        expect(source.entries()).toEqual([["a", 1], ["b", 2]])
    })

    test("zip extends to the longer side with undefined and always reindexes", () => {
        expect(collect([1, 2, 3]).zip(["a"]).entries()).toEqual([
            [0, [1, "a"]],
            [1, [2, undefined]],
            [2, [3, undefined]],
        ])
        expect(collect([1]).zip(["a", "b", "c"]).items()).toEqual([
            [1, "a"],
            [undefined, "b"],
            [undefined, "c"],
        ])
        expect(collect([] as number[]).zip([] as string[]).empty()).toBe(true)
    })

    test("crossJoin uses left-major Cartesian-product order and empties when either side is empty", () => {
        expect(collect([1, 2]).crossJoin(["a", "b", "c"]).items()).toEqual([
            [1, "a"],
            [1, "b"],
            [1, "c"],
            [2, "a"],
            [2, "b"],
            [2, "c"],
        ])
        expect(collect([] as number[]).crossJoin(["a"]).empty()).toBe(true)
        expect(collect([1]).crossJoin([] as string[]).empty()).toBe(true)
    })
})

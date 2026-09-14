import { describe, expect, test } from "bun:test"

import { collect } from "#collections"

const records = collect({
    alpha: { meta: { score: 10, tag: "a" }, active: true, note: null },
    beta: { meta: { score: 20, tag: "b" }, active: false, note: "ready" },
    gamma: { meta: { score: 30, tag: "b" }, active: true, note: undefined },
})

describe("query helpers", () => {
    test("map variants preserve or intentionally replace keys", () => {
        expect(records.map((value) => value.meta.score).entries()).toEqual([
            ["alpha", 10],
            ["beta", 20],
            ["gamma", 30],
        ])
        expect(records.mapValues((value) => value.active).keys()).toEqual(["alpha", "beta", "gamma"])
        expect(records.mapKeys((_, key) => key.toUpperCase()).keys()).toEqual(["ALPHA", "BETA", "GAMMA"])
        expect(records.mapWithKeys((value) => [value.meta.tag, value.meta.score] as const).entries()).toEqual([
            ["a", 10],
            ["b", 30],
        ])
    })

    test("filter and reject receive keys and preserve accepted keys", () => {
        expect(records.filter((value, key) => value.active && key !== "gamma").keys()).toEqual(["alpha"])
        expect(records.reject((value) => value.active).keys()).toEqual(["beta"])
    })

    test("pluck and keyBy resolve nested paths", () => {
        expect(records.pluck("meta.score").items()).toEqual([10, 20, 30])
        expect(records.keyBy("meta.tag").get("b")?.meta.score).toBe(30)
        expect(records.keyBy((value) => `score:${value.meta.score}`).keys()).toEqual([
            "score:10",
            "score:20",
            "score:30",
        ])
    })

    test("where variants use strict nested-path comparison", () => {
        expect(records.where("active", true).keys()).toEqual(["alpha", "gamma"])
        expect(records.whereNot("active", true).keys()).toEqual(["beta"])
        expect(records.whereIn("meta.score", [10, 30]).keys()).toEqual(["alpha", "gamma"])
        expect(records.whereNotIn("meta.tag", ["b"]).keys()).toEqual(["alpha"])
        expect(records.whereNull("note").keys()).toEqual(["alpha", "gamma"])
        expect(records.whereNotNull("note").keys()).toEqual(["beta"])
    })

    test("contains, doesntContain, every and some cover value and predicate forms", () => {
        const numbers = collect([1, 2, 3] as number[])

        expect(numbers.contains(2)).toBe(true)
        expect(numbers.contains((value) => value > 2)).toBe(true)
        expect(numbers.doesntContain(4)).toBe(true)
        expect(numbers.doesntContain((value) => value < 0)).toBe(true)
        expect(numbers.every((value) => value > 0)).toBe(true)
        expect(numbers.every((value) => value < 3)).toBe(false)
        expect(numbers.some((value) => value === 2)).toBe(true)
        expect(numbers.some((value) => value === 9)).toBe(false)
    })

    test("flatten obeys finite depth and treats strings as atomic values", () => {
        const nested = collect([[[1], [2]], [[3]]])

        expect(nested.flatten(0).items()).toEqual([[[1], [2]], [[3]]])
        expect(nested.flatten(1).items()).toEqual([[1], [2], [3]])
        expect(nested.flatten(2).items()).toEqual([1, 2, 3])
        expect(collect(["ab", ["cd"]]).flatten().items()).toEqual(["ab", "cd"])
    })
})

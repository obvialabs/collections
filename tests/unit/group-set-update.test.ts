import { describe, expect, test } from "bun:test"

import { collect } from "#collections"

describe("grouping, sets and immutable updates", () => {
    const users = collect({
        a: { role: "admin", score: 10 },
        b: { role: "member", score: 20 },
        c: { role: "member", score: 20 },
    })

    test("groupBy and countBy support paths and callbacks", () => {
        expect(users.groupBy("role").get("member")?.keys()).toEqual(["b", "c"])
        expect(users.groupBy((user) => user.score >= 20).get(true)?.keys()).toEqual(["b", "c"])
        expect(users.countBy("role").entries()).toEqual([["admin", 1], ["member", 2]])
        expect(users.countBy((user) => user.score).entries()).toEqual([[10, 1], [20, 2]])
    })

    test("unique and duplicates use first-seen semantics", () => {
        const values = collect(new Map([["a", 1], ["b", 2], ["c", 1], ["d", 1]]))

        expect(values.unique().entries()).toEqual([["a", 1], ["b", 2]])
        expect(values.duplicates().entries()).toEqual([["c", 1], ["d", 1]])
        expect(users.unique((user) => user.score).keys()).toEqual(["a", "b"])
    })

    test("diff and intersection variants never add foreign entries", () => {
        const values = collect(new Map([["a", 1], ["b", 2], ["c", 3]]))

        expect(values.diff([2, 9]).entries()).toEqual([["a", 1], ["c", 3]])
        expect(values.intersect([2, 9]).entries()).toEqual([["b", 2]])
        expect(values.diffKeys(["b", "missing"]).keys()).toEqual(["a", "c"])
        expect(values.intersectByKeys(["b", "missing"]).keys()).toEqual(["b"])
    })

    test("union keeps existing values while merge replaces collisions", () => {
        const values = collect(new Map([["a", 1], ["b", 2]]))

        expect(values.union([["b", 20], ["c", 3]]).entries()).toEqual([["a", 1], ["b", 2], ["c", 3]])
        expect(values.merge([["b", 20], ["c", 3]]).entries()).toEqual([["a", 1], ["b", 20], ["c", 3]])
        expect(values.replace([["b", 20], ["c", 3]]).entries()).toEqual([["a", 1], ["b", 20]])
    })

    test("with, append, prepend and remove return new collections", () => {
        const values = collect(new Map< string | number, string >([["a", "A"], [4, "four"]]))

        expect(values.with("b", "B").get("b")).toBe("B")
        expect(values.append("five").get(5)).toBe("five")
        expect(values.prepend("first").items()).toEqual(["first", "A", "four"])
        expect(values.remove("a").has("a")).toBe(false)
        expect(values.has("a")).toBe(true)
    })

    test("zip and crossJoin define mismatched and Cartesian behavior", () => {
        expect(collect([1, 2]).zip(["a"]).items()).toEqual([[1, "a"], [2, undefined]])
        expect(collect([1]).zip(["a", "b"]).items()).toEqual([[1, "a"], [undefined, "b"]])
        expect(collect([1, 2]).crossJoin(["a", "b"]).items()).toEqual([
            [1, "a"], [1, "b"], [2, "a"], [2, "b"],
        ])
    })
})

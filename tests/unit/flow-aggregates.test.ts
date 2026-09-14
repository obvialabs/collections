import { describe, expect, test } from "bun:test"

import { collect } from "#collections"

describe("flow, aggregation and strings", () => {
    test("reduce, each, tap and pipe preserve their flow contracts", () => {
        const values = collect([1, 2, 3, 4])
        const visited: number[] = []
        let tapped = false

        expect(values.reduce((sum, value) => sum + value, 0)).toBe(10)
        expect(values.each((value) => {
            visited.push(value)
            return value < 2
        })).toBe(values)
        expect(visited).toEqual([1, 2])
        expect(values.tap((collection) => {
            tapped = true
            expect(collection).toBe(values)
        })).toBe(values)
        expect(tapped).toBe(true)
        expect(values.pipe((collection) => collection.sum())).toBe(10)
    })

    test("when and unless invoke only the selected branch", () => {
        const values = collect([1, 2, 3])
        let whenCalls = 0
        let unlessCalls = 0

        expect(values.when(true, (collection) => {
            whenCalls += 1
            return collection.take(1)
        }).items()).toEqual([1])
        expect(values.when(false, (collection) => {
            whenCalls += 1
            return collection.take(1)
        })).toBe(values)
        expect(values.unless(false, (collection) => {
            unlessCalls += 1
            return collection.take(-1)
        }).items()).toEqual([3])
        expect(values.unless(true, (collection) => {
            unlessCalls += 1
            return collection.take(1)
        })).toBe(values)
        expect(whenCalls).toBe(1)
        expect(unlessCalls).toBe(1)
    })

    test("aggregates cover empty, odd, even and selected values", () => {
        const values = collect([1, 2, 2, 5])
        const empty = collect([] as number[])

        expect(values.sum()).toBe(10)
        expect(values.sum((value) => value * 2)).toBe(20)
        expect(values.average()).toBe(2.5)
        expect(values.avg()).toBe(2.5)
        expect(values.min()).toBe(1)
        expect(values.max()).toBe(5)
        expect(values.median()).toBe(2)
        expect(collect([1, 2, 5]).median()).toBe(2)
        expect(values.mode()).toEqual([2])
        expect(collect([1, 1, 2, 2]).mode()).toEqual([1, 2])
        expect(empty.sum()).toBe(0)
        expect(empty.average()).toBeUndefined()
        expect(empty.min()).toBeUndefined()
        expect(empty.max()).toBeUndefined()
        expect(empty.median()).toBeUndefined()
        expect(empty.mode()).toEqual([])
    })

    test("join, implode and values produce expected native/numeric output", () => {
        const users = collect({
            a: { name: "Ada" },
            b: { name: "Grace" },
            c: { name: "Linus" },
        })

        expect(collect(["a"]).join(", ", " and ")).toBe("a")
        expect(collect(["a", "b"]).join(", ", " and ")).toBe("a and b")
        expect(collect(["a", "b", "c"]).join(", ", " and ")).toBe("a, b and c")
        expect(users.implode("name", " | ")).toBe("Ada | Grace | Linus")
        expect(users.values().keys()).toEqual([0, 1, 2])
        expect(users.values().items().map((user) => user.name)).toEqual(["Ada", "Grace", "Linus"])
    })
})

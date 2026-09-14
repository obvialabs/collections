import { describe, expect, test } from "bun:test"

import { collect, createCollection } from "../../dist/index.js"

describe("flow, aggregate, string and iteration contracts", () => {
    test("reduce visits values in iteration order, exposes keys and returns initial on empty", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
        ]))
        const visited: string[] = []

        expect(source.reduce((carry, value, key) => {
            visited.push(key)
            return carry + value
        }, 10)).toBe(16)
        expect(visited).toEqual(["a", "b", "c"])
        expect(collect([] as number[]).reduce((carry, value) => carry + value, 7)).toBe(7)
    })

    test("each returns the same instance and stops only on literal false", () => {
        const source = collect([1, 2, 3, 4])
        const visited: number[] = []
        const result = source.each((value) => {
            visited.push(value)
            if (value === 3) return false
            return undefined
        })

        expect(result).toBe(source)
        expect(visited).toEqual([1, 2, 3])
    })

    test("tap calls once with the same collection and returns the same instance", () => {
        const source = collect([1, 2, 3])
        let calls = 0

        const result = source.tap((collection) => {
            calls += 1
            expect(collection).toBe(source)
        })

        expect(calls).toBe(1)
        expect(result).toBe(source)
    })

    test("pipe returns the callback result without wrapping it", () => {
        const source = collect([1, 2, 3])
        const object = source.pipe((collection) => ({
            count: collection.count(),
            sum: collection.sum(),
        }))

        expect(object).toEqual({ count: 3, sum: 6 })
    })

    test("when invokes only for true and otherwise preserves identity", () => {
        const source = collect([1, 2, 3])
        let calls = 0

        const unchanged = source.when(false, (collection) => {
            calls += 1
            return collection.take(1)
        })
        const changed = source.when(true, (collection) => {
            calls += 1
            return collection.take(1)
        })

        expect(unchanged).toBe(source)
        expect(changed.items()).toEqual([1])
        expect(calls).toBe(1)
    })

    test("unless invokes only for false and otherwise preserves identity", () => {
        const source = collect([1, 2, 3])
        let calls = 0

        const unchanged = source.unless(true, (collection) => {
            calls += 1
            return collection.take(1)
        })
        const changed = source.unless(false, (collection) => {
            calls += 1
            return collection.take(1)
        })

        expect(unchanged).toBe(source)
        expect(changed.items()).toEqual([1])
        expect(calls).toBe(1)
    })

    test("sum defaults to Number(value) and selector receives source keys", () => {
        expect(collect([1, "2", true]).sum()).toBe(4)

        const source = collect(new Map([
            ["a", { amount: 2 }],
            ["b", { amount: 3 }],
        ]))
        const visited: string[] = []

        expect(source.sum((value, key) => {
            visited.push(key)
            return value.amount
        })).toBe(5)
        expect(visited).toEqual(["a", "b"])
    })

    test("average and avg are aliases and return undefined for empty collections", () => {
        const source = collect([2, 4, 6])

        expect(source.average()).toBe(4)
        expect(source.avg()).toBe(4)
        expect(collect([] as number[]).average()).toBeUndefined()
        expect(collect([] as number[]).avg()).toBeUndefined()
    })

    test("min and max return selected comparable values rather than original items", () => {
        const source = collect([
            { name: "a", score: 30 },
            { name: "b", score: 10 },
            { name: "c", score: 20 },
        ])

        expect(source.min((value) => value.score)).toBe(10)
        expect(source.max((value) => value.score)).toBe(30)
        expect(collect([] as number[]).min()).toBeUndefined()
        expect(collect([] as number[]).max()).toBeUndefined()
    })

    test("min and max support bigint and Date selector results", () => {
        expect(collect([3n, 1n, 2n]).min()).toBe(1n)
        expect(collect([3n, 1n, 2n]).max()).toBe(3n)

        const early = new Date("2025-01-01T00:00:00Z")
        const late = new Date("2026-01-01T00:00:00Z")
        expect(collect([late, early]).min()).toBe(early)
        expect(collect([early, late]).max()).toBe(late)
    })

    test("median handles odd, even, singleton, selector and empty cases", () => {
        expect(collect([9, 1, 5]).median()).toBe(5)
        expect(collect([4, 1, 3, 2]).median()).toBe(2.5)
        expect(collect([7]).median()).toBe(7)
        expect(collect([{ score: 10 }, { score: 30 }, { score: 20 }]).median((item) => item.score)).toBe(20)
        expect(collect([] as number[]).median()).toBeUndefined()
    })


    test("median uses deterministic numeric ordering when NaN is present", () => {
        expect(collect([Number.NaN, 1, 2]).median()).toBe(2)
        expect(collect([Number.NaN, 1, 2, 3]).median()).toBe(2.5)
    })

    test("mode returns all highest-frequency values in first-seen order", () => {
        expect(collect([1, 2, 1, 2, 3]).mode()).toEqual([1, 2])
        expect(collect([Number.NaN, Number.NaN, 1]).mode().length).toBe(1)
        expect(Number.isNaN(collect([Number.NaN, Number.NaN, 1]).mode()[0] as number)).toBe(true)
        expect(collect([] as number[]).mode()).toEqual([])
    })

    test("join covers empty, singleton, normal glue and final glue", () => {
        expect(collect([] as string[]).join(", ")).toBe("")
        expect(collect(["a"]).join(", ", " and ")).toBe("a")
        expect(collect(["a", "b"]).join(", ", " and ")).toBe("a and b")
        expect(collect(["a", "b", "c"]).join(", ", " and ")).toBe("a, b and c")
        expect(collect(["a", "b", "c"]).join(" | ")).toBe("a | b | c")
    })

    test("implode resolves a nested path and stringifies each resolved value", () => {
        const users = createCollection({
            ada: { profile: { email: "ada@example.com" } },
            grace: { profile: { email: "grace@example.com" } },
        })

        expect(users.implode("profile.email", ", ")).toBe("ada@example.com, grace@example.com")
    })

    test("Symbol.iterator yields entry tuples in current order and works repeatedly", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
        ]))

        expect([...source]).toEqual([["a", 1], ["b", 2]])
        expect([...source]).toEqual([["a", 1], ["b", 2]])
        expect(new Map(source)).toEqual(new Map([["a", 1], ["b", 2]]))
    })

})

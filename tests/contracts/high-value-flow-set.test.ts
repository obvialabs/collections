import { describe, expect, test } from "bun:test"

import { Collection, collect } from "#collections"

describe("high-value set, ordering, flow and filtering contracts", () => {
    test("diffAssoc and intersectAssoc compare both key and value using Object.is", () => {
        const source = collect(new Map<string, number>([
            ["nan", Number.NaN],
            ["positive", 0],
            ["negative", -0],
            ["other", 5],
        ]))
        const other = new Map<string, number>([
            ["nan", Number.NaN],
            ["positive", -0],
            ["negative", -0],
            ["other", 9],
        ])

        expect(source.intersectAssoc(other).keys()).toEqual(["nan", "negative"])
        expect(source.diffAssoc(other).keys()).toEqual(["positive", "other"])
    })

    test("eachSpread spreads tuple values, appends keys and stops on literal false", () => {
        const source = collect(new Map<string, readonly [number, number]>([
            ["a", [1, 2]],
            ["b", [3, 4]],
            ["c", [5, 6]],
        ]))
        const seen: string[] = []

        const result = source.eachSpread((left, right, key) => {
            seen.push(`${key}:${left + right}`)
            return key === "b" ? false : undefined
        })

        expect(result).toBe(source)
        expect(seen).toEqual(["a:3", "b:7"])
    })

    test("percentage returns rounded percentages, supports negative precision and returns undefined when empty", () => {
        const source = collect([1, 2, 3, 4, 5, 6])

        expect(source.percentage((value) => value % 2 === 0)).toBe(50)
        expect(collect([1, 2, 3]).percentage((value) => value > 1, 2)).toBe(66.67)
        expect(collect([1, 2, 3, 4, 5, 6, 7]).percentage(() => true, -1)).toBe(100)
        expect(collect([] as number[]).percentage(() => true)).toBeUndefined()
    })

    test("pipeInto constructs a wrapper with the same collection instance", () => {
        class Summary {
            public constructor(public readonly collection: Collection<number, number>) {}
        }

        const source = collect([1, 2, 3])
        const wrapped = source.pipeInto(Summary)

        expect(wrapped).toBeInstanceOf(Summary)
        expect(wrapped.collection).toBe(source)
    })

    test("pipeThrough applies callbacks left-to-right and returns the last result", () => {
        const source = collect([1, 2, 3])

        expect(source.pipeThrough([])).toBe(source)
        expect(source.pipeThrough([
            (collection) => collection.sum(),
            (sum) => sum * 2,
            (value) => `total:${value}`,
        ])).toBe("total:12")
    })

    test("reduceSpread carries multiple accumulators and exposes source keys", () => {
        const source = collect(new Map([
            ["a", 2],
            ["b", 3],
            ["c", 5],
        ]))

        const [sum, keys] = source.reduceSpread(
            (sum, keys, value, key) => [sum + value, [...keys, key]],
            0,
            [] as string[],
        )

        expect(sum).toBe(10)
        expect(keys).toEqual(["a", "b", "c"])
    })

    test("whenEmpty and unlessNotEmpty run the empty branch; counterparts run the non-empty branch", () => {
        const empty = collect([] as number[])
        const full = collect<number>([1, 2, 3])
        const emptyReplacement = collect<number>([9])
        const fullReplacement = collect<number>([8])

        expect(empty.whenEmpty(() => emptyReplacement)).toBe(emptyReplacement)
        expect(empty.unlessNotEmpty(() => emptyReplacement)).toBe(emptyReplacement)
        expect(full.whenNotEmpty(() => fullReplacement)).toBe(fullReplacement)
        expect(full.unlessEmpty(() => fullReplacement)).toBe(fullReplacement)

        expect(full.whenEmpty(() => emptyReplacement)).toBe(full)
        expect(empty.whenNotEmpty(() => fullReplacement)).toBe(empty)
    })

    test("conditional empty helpers execute fallback only on the opposite branch", () => {
        const empty = collect([] as number[])
        const full = collect<number>([1])
        let primaryCalls = 0
        let fallbackCalls = 0

        const fullResult = full.whenEmpty(
            () => {
                primaryCalls += 1
                return collect<number>([2])
            },
            (collection) => {
                fallbackCalls += 1
                return collection
            },
        )
        const emptyResult = empty.whenNotEmpty(
            () => {
                primaryCalls += 1
                return collect<number>([2])
            },
            (collection) => {
                fallbackCalls += 1
                return collection
            },
        )

        expect(fullResult).toBe(full)
        expect(emptyResult).toBe(empty)
        expect(primaryCalls).toBe(0)
        expect(fallbackCalls).toBe(2)
    })

    test("sortDesc uses deterministic descending value order and keeps stable ties", () => {
        const source = collect(new Map([
            ["a", 2],
            ["b", 3],
            ["c", 2],
            ["d", 1],
        ]))

        expect(source.sortDesc().entries()).toEqual([
            ["b", 3],
            ["a", 2],
            ["c", 2],
            ["d", 1],
        ])
    })

    test("sortKeysUsing delegates key ordering to the supplied comparator", () => {
        const source = collect(new Map([
            ["bbb", 3],
            ["a", 1],
            ["cc", 2],
        ]))
        const seen: Array<readonly [string, string]> = []

        const sorted = source.sortKeysUsing((left, right) => {
            seen.push([left, right])
            return left.length - right.length || left.localeCompare(right)
        })

        expect(sorted.keys()).toEqual(["a", "cc", "bbb"])
        expect(seen.length).toBeGreaterThan(0)
    })

    test("whereBetween and whereNotBetween use inclusive deterministic range ordering", () => {
        const source = collect([
            { score: 10 },
            { score: 20 },
            { score: 30 },
            { score: 40 },
        ])

        expect(source.whereBetween("score", [20, 30]).pluck("score").items()).toEqual([20, 30])
        expect(source.whereNotBetween("score", [20, 30]).pluck("score").items()).toEqual([10, 40])
    })

    test("whereBetween supports Date values through deterministic comparison", () => {
        const early = new Date("2026-01-01T00:00:00Z")
        const middle = new Date("2026-06-01T00:00:00Z")
        const late = new Date("2026-12-01T00:00:00Z")
        const source = collect([{ at: early }, { at: middle }, { at: late }])

        expect(source.whereBetween("at", [early, middle]).pluck("at").items()).toEqual([early, middle])
    })

    test("whereInstanceOf accepts one or several classes and drops non-instances", () => {
        class Cat { public readonly kind = "cat" }
        class Dog { public readonly kind = "dog" }
        class Bird { public readonly kind = "bird" }

        const cat = new Cat()
        const dog = new Dog()
        const bird = new Bird()
        const source = collect<Cat | Dog | Bird | string>([cat, dog, bird, "plain"])

        expect(source.whereInstanceOf(Cat).items()).toEqual([cat])
        expect(source.whereInstanceOf([Cat, Dog]).items()).toEqual([cat, dog])
    })
})

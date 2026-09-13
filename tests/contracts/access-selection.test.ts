import { describe, expect, test } from "bun:test"

import {
    Collection,
    CollectionItemNotFoundError,
    CollectionMultipleItemsError,
    collect,
} from "../../dist/index.js"

describe("key access and selection contracts", () => {
    test("get and has distinguish a missing key from a present undefined value", () => {
        const collection = new Collection<string, number | undefined>([
            ["present", undefined],
        ])

        expect(collection.get("present")).toBeUndefined()
        expect(collection.get("missing")).toBeUndefined()
        expect(collection.has("present")).toBe(true)
        expect(collection.has("missing")).toBe(false)
    })

    test("getOr resolves fallback only when the key is absent", () => {
        const collection = new Collection<string, number | undefined>([
            ["present", undefined],
        ])
        let calls = 0

        expect(collection.getOr("present", () => {
            calls += 1
            return 1
        })).toBeUndefined()
        expect(collection.getOr("missing", (key) => {
            calls += 1
            expect(key).toBe("missing")
            return 7
        })).toBe(7)
        expect(collection.getOr("other", 9)).toBe(9)
        expect(calls).toBe(1)
    })

    test("hasAny short-circuits and hasAll uses vacuous truth for no requested keys", () => {
        const collection = collect(new Map([
            ["a", 1],
            ["b", 2],
        ]))
        let anyReads = 0
        let allReads = 0

        function* anyKeys(): Generator<string> {
            anyReads += 1
            yield "a"
            anyReads += 1
            yield "missing"
        }
        function* allKeys(): Generator<string> {
            allReads += 1
            yield "missing"
            allReads += 1
            yield "a"
        }

        expect(collection.hasAny(anyKeys())).toBe(true)
        expect(anyReads).toBe(1)
        expect(collection.hasAll(allKeys())).toBe(false)
        expect(allReads).toBe(1)
        expect(collection.hasAny([])).toBe(false)
        expect(collection.hasAll([])).toBe(true)
    })

    test("search(value) uses Object.is semantics", () => {
        const collection = new Collection<string, number>([
            ["nan", Number.NaN],
            ["positive-zero", 0],
            ["negative-zero", -0],
        ])

        expect(collection.search(Number.NaN)).toBe("nan")
        expect(collection.search(0)).toBe("positive-zero")
        expect(collection.search(-0)).toBe("negative-zero")
    })

    test("search(predicate) receives keys and stops after the first match", () => {
        const collection = collect(new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
        ]))
        const visited: string[] = []

        expect(collection.search((value, key) => {
            visited.push(`${key}:${value}`)
            return value === 2
        })).toBe("b")
        expect(visited).toEqual(["a:1", "b:2"])
    })

    test("first and last support empty collections, predicates and original keys", () => {
        const empty = collect([] as number[])
        const collection = collect(new Map([
            ["a", 10],
            ["b", 20],
            ["c", 30],
        ]))
        const firstVisited: string[] = []
        const lastVisited: string[] = []

        expect(empty.first()).toBeUndefined()
        expect(empty.last()).toBeUndefined()
        expect(collection.first()).toBe(10)
        expect(collection.last()).toBe(30)
        expect(collection.first((value, key) => {
            firstVisited.push(key)
            return value >= 20
        })).toBe(20)
        expect(collection.last((value, key) => {
            lastVisited.push(key)
            return value <= 20
        })).toBe(20)
        expect(firstVisited).toEqual(["a", "b"])
        expect(lastVisited).toEqual(["a", "b", "c"])
    })

    test("firstOrFail and lastOrFail honor predicates and expose original keys", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
            ["d", 4],
        ]))
        const firstVisited: string[] = []
        const lastVisited: string[] = []

        expect(source.firstOrFail((value, key) => {
            firstVisited.push(key)
            return value % 2 === 0
        })).toBe(2)
        expect(firstVisited).toEqual(["a", "b"])

        expect(source.lastOrFail((value, key) => {
            lastVisited.push(key)
            return value % 2 === 0
        })).toBe(4)
        expect(lastVisited).toEqual(["a", "b", "c", "d"])
        expect(() => source.lastOrFail((value) => value > 10)).toThrow()
    })

    test("firstOrFail and lastOrFail can return a real undefined value", () => {
        const collection = new Collection<string, number | undefined>([
            ["undefined", undefined],
        ])

        expect(collection.firstOrFail()).toBeUndefined()
        expect(collection.lastOrFail()).toBeUndefined()
        expect(() => collect([] as number[]).firstOrFail()).toThrow(CollectionItemNotFoundError)
        expect(() => collect([] as number[]).lastOrFail()).toThrow(CollectionItemNotFoundError)
    })

    test("sole distinguishes zero, one and multiple matches and stops at the second match", () => {
        const values = collect([1, 2, 3, 4])
        const visited: number[] = []

        expect(values.sole((value) => value === 3)).toBe(3)
        expect(() => values.sole((value) => {
            visited.push(value)
            return value % 2 === 0
        })).toThrow(CollectionMultipleItemsError)
        expect(visited).toEqual([1, 2, 3, 4])
        expect(() => values.sole((value) => value > 10)).toThrow(CollectionItemNotFoundError)
        expect(collect([42]).sole()).toBe(42)
    })

    test("nth preserves keys and supports offsets at and beyond the end", () => {
        const collection = collect(new Map([
            ["a", 10],
            ["b", 20],
            ["c", 30],
            ["d", 40],
            ["e", 50],
        ]))

        expect(collection.nth(2).entries()).toEqual([
            ["a", 10],
            ["c", 30],
            ["e", 50],
        ])
        expect(collection.nth(2, 1).entries()).toEqual([
            ["b", 20],
            ["d", 40],
        ])
        expect(collection.nth(2, 5).empty()).toBe(true)
        expect(collection.nth(99).entries()).toEqual([["a", 10]])
    })

    test("random on an empty collection is absent and random(count) never invents values", () => {
        const values = collect(["a", "b", "c", "d"])

        expect(collect([] as string[]).random()).toBeUndefined()
        expect(values.random(0).items()).toEqual([])

        for (let attempt = 0; attempt < 30; attempt += 1) {
            const one = values.random()
            const three = values.random(3)

            expect(values.contains(one!)).toBe(true)
            expect(three.count()).toBe(3)
            expect(new Set(three.items()).size).toBe(3)
            expect(three.every((value) => values.contains(value))).toBe(true)
            expect(three.keys()).toEqual([0, 1, 2])
        }
    })
})

import { describe, expect, test } from "bun:test"

import { Collection, collect } from "../../dist/index.js"

describe("access and selection", () => {
    test("exports defensive value, key, entry, array and map snapshots", () => {
        const collection = collect(new Map([["a", 1], ["b", 2]]))

        expect(collection.items()).toEqual([1, 2])
        expect(collection.all()).toEqual([1, 2])
        expect(collection.keys()).toEqual(["a", "b"])
        expect(collection.entries()).toEqual([["a", 1], ["b", 2]])
        expect(collection.toArray()).toEqual([1, 2])
        expect([...collection.toMap()]).toEqual([["a", 1], ["b", 2]])
    })

    test("toObject supports string, number and symbol keys", () => {
        const symbol = Symbol("token")
        const collection = new Collection<PropertyKey, number>([
            ["name", 1],
            [2, 2],
            [symbol, 3],
        ])
        const object = collection.toObject()

        expect(Object.getPrototypeOf(object)).toBeNull()
        expect(object.name).toBe(1)
        expect(object[2]).toBe(2)
        expect(object[symbol]).toBe(3)
    })

    test("get, getOr, has, hasAny and hasAll distinguish key presence", () => {
        const collection = new Collection<string, number | undefined>([
            ["a", 1],
            ["undefined", undefined],
        ])
        let fallbackCalls = 0

        expect(collection.get("a")).toBe(1)
        expect(collection.get("missing")).toBeUndefined()
        expect(collection.getOr("undefined", () => {
            fallbackCalls += 1
            return 2
        })).toBeUndefined()
        expect(collection.getOr("missing", (key) => {
            fallbackCalls += 1
            expect(key).toBe("missing")
            return 9
        })).toBe(9)
        expect(fallbackCalls).toBe(1)
        expect(collection.has("a")).toBe(true)
        expect(collection.hasAny(["missing", "a"])).toBe(true)
        expect(collection.hasAny(["missing", "other"])).toBe(false)
        expect(collection.hasAll(["a", "undefined"])).toBe(true)
        expect(collection.hasAll(["a", "missing"])).toBe(false)
    })

    test("search resolves direct values and predicates", () => {
        const object = { id: 1 }
        const collection = new Collection<string, object | number>([
            ["object", object],
            ["number", 7],
        ])

        expect(collection.search(object)).toBe("object")
        expect(collection.search((value: object | number) => typeof value === "number")).toBe("number")
        expect(collection.search(99)).toBeUndefined()
    })

    test("first, last and nth preserve collection order and keys", () => {
        const collection = collect(new Map([["a", 10], ["b", 20], ["c", 30], ["d", 40]]))

        expect(collection.first()).toBe(10)
        expect(collection.first((value) => value > 15)).toBe(20)
        expect(collection.last()).toBe(40)
        expect(collection.last((value) => value < 35)).toBe(30)
        expect(collection.nth(2).entries()).toEqual([["a", 10], ["c", 30]])
        expect(collection.nth(2, 1).entries()).toEqual([["b", 20], ["d", 40]])
    })
})

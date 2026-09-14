import { describe, expect, test } from "bun:test"

import { Collection, collect } from "../../dist/index.js"

describe("state, snapshots and conversion contracts", () => {
    test("count, empty and notEmpty agree for empty, singleton and populated collections", () => {
        const cases = [
            { collection: collect([] as number[]), count: 0, empty: true },
            { collection: collect([1]), count: 1, empty: false },
            { collection: collect([1, 2, 3]), count: 3, empty: false },
        ]

        for (const current of cases) {
            expect(current.collection.count()).toBe(current.count)
            expect(current.collection.empty()).toBe(current.empty)
            expect(current.collection.notEmpty()).toBe(!current.empty)
        }
    })

    test("items, all, keys and entries preserve iteration order", () => {
        const collection = collect(new Map([
            ["third", 30],
            ["first", 10],
            ["second", 20],
        ]))

        expect(collection.items()).toEqual([30, 10, 20])
        expect(collection.all()).toEqual([30, 10, 20])
        expect(collection.keys()).toEqual(["third", "first", "second"])
        expect(collection.entries()).toEqual([
            ["third", 30],
            ["first", 10],
            ["second", 20],
        ])
    })

    test("snapshot methods return fresh containers and never expose membership mutation", () => {
        const collection = collect(new Map([
            ["a", 1],
            ["b", 2],
        ]))

        const itemsA = collection.items() as number[]
        const itemsB = collection.items()
        const keys = collection.keys() as string[]
        const entries = collection.entries() as Array<[string, number]>
        const array = collection.toArray()
        const map = collection.toMap() as Map<string, number>

        expect(itemsA === itemsB).toBe(false)

        itemsA.push(9)
        keys.reverse()
        entries[0] = ["changed", 99]
        array.splice(0, array.length)
        map.set("c", 3)

        expect(collection.entries()).toEqual([
            ["a", 1],
            ["b", 2],
        ])
    })

    test("toObject returns a null-prototype object and safely supports __proto__", () => {
        const collection = new Collection<PropertyKey, number>([
            ["__proto__", 1],
            ["constructor", 2],
        ])
        const object = collection.toObject()

        expect(Object.getPrototypeOf(object)).toBeNull()
        expect(object.__proto__).toBe(1)
        expect(object.constructor).toBe(2)
    })

    test("toObject supports strings, numbers and symbols", () => {
        const symbol = Symbol("symbol-key")
        const object = new Collection<PropertyKey, string>([
            ["alpha", "a"],
            [7, "seven"],
            [symbol, "symbol"],
        ]).toObject()

        expect(object.alpha).toBe("a")
        expect(object[7]).toBe("seven")
        expect(object[symbol]).toBe("symbol")
        expect(Reflect.ownKeys(object)).toEqual(["7", "alpha", symbol])
    })

    test("toObject rejects non-property keys instead of coercing them", () => {
        const key = { id: 1 }
        const collection = new Collection<object, string>([[key, "value"]])

        expect(() => collection.toObject()).toThrow(TypeError)
    })

    test("values discards original keys and reindexes values contiguously", () => {
        const source = collect(new Map([
            ["x", 10],
            ["y", 20],
        ]))
        const values = source.values()

        expect(values.entries()).toEqual([
            [0, 10],
            [1, 20],
        ])
        expect(source.keys()).toEqual(["x", "y"])
    })

    test("collections are shallow containers and do not deep-clone values", () => {
        const value = { profile: { enabled: true } }
        const collection = collect([value])

        value.profile.enabled = false

        expect(collection.first()?.profile.enabled).toBe(false)
        expect(collection.first()).toBe(value)
    })
})


describe("object conversion collision safety", () => {
    test("toObject rejects keys that collapse to the same JavaScript property key", () => {
        const collection = new Collection<PropertyKey, string>([
            [1, "number"],
            ["1", "string"],
        ])

        expect(() => collection.toObject()).toThrow(TypeError)
    })

    test("toObject keeps distinct symbols separate from their descriptions", () => {
        const first = Symbol("same")
        const second = Symbol("same")
        const object = new Collection<PropertyKey, number>([
            [first, 1],
            [second, 2],
        ]).toObject()

        expect(object[first]).toBe(1)
        expect(object[second]).toBe(2)
        expect(Reflect.ownKeys(object)).toEqual([first, second])
    })
})

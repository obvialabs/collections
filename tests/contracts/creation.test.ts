import { describe, expect, test } from "bun:test"

import { Collection, collect } from "../../dist/index.js"

describe("collection creation contracts", () => {
    test("collect() creates an empty numerically keyed collection", () => {
        const collection = collect()

        expect(collection).toBeInstanceOf(Collection)
        expect(collection.count()).toBe(0)
        expect(collection.keys()).toEqual([])
        expect(collection.items()).toEqual([])
        expect(collection.empty()).toBe(true)
        expect(collection.notEmpty()).toBe(false)
    })

    test("collect(array) snapshots membership and assigns contiguous numeric keys", () => {
        const source = ["alpha", "beta"]
        const collection = collect(source)

        source[0] = "changed"
        source.push("gamma")

        expect(collection.entries()).toEqual([
            [0, "alpha"],
            [1, "beta"],
        ])
    })

    test("collect(object) preserves source values without injecting fields", () => {
        const google = { label: "Google" }
        const source = {
            google,
            github: { label: "GitHub" },
        }
        const collection = collect(source)

        expect(collection.keys()).toEqual(["google", "github"])
        expect(collection.get("google")).toBe(google)
        expect(collection.get("google")).toEqual({ label: "Google" })
        expect("id" in collection.get("google")!).toBe(false)
        expect(Object.prototype.hasOwnProperty.call(collection, "google")).toBe(false)
    })

    test("collect(object) makes method-name keys safe through get() and toObject()", () => {
        const collection = collect({
            map: { label: "Map item" },
            filter: { label: "Filter item" },
            count: { label: "Count item" },
            constructor: { label: "Constructor item" },
            ["__proto__"]: { label: "Prototype item" },
        })

        expect(typeof collection.map).toBe("function")
        expect(typeof collection.filter).toBe("function")
        expect(typeof collection.count).toBe("function")
        expect(typeof collection.constructor).toBe("function")
        expect(collection.get("map")?.label).toBe("Map item")
        expect(collection.get("filter")?.label).toBe("Filter item")
        expect(collection.get("count")?.label).toBe("Count item")
        expect(collection.get("constructor")?.label).toBe("Constructor item")
        expect(collection.get("__proto__")?.label).toBe("Prototype item")

        const object = collection.toObject()
        expect(Object.getPrototypeOf(object)).toBeNull()
        expect(object.map.label).toBe("Map item")
        expect(object.constructor.label).toBe("Constructor item")
        expect(object.__proto__.label).toBe("Prototype item")
    })

    test("collect(object) normalizes numeric keys and excludes symbol properties", () => {
        const symbol = Symbol("ignored")
        const source = {
            1: "one",
            alpha: "alpha",
            [symbol]: "symbol",
        } as const
        const collection = collect(source)

        expect(collection.entries()).toEqual([
            ["1", "one"],
            ["alpha", "alpha"],
        ])
        expect(collection.has("1")).toBe(true)
        expect(collection.toObject()).toEqual({
            1: "one",
            alpha: "alpha",
        })
    })

    test("collect(object) follows Object.entries enumerable-own-property order", () => {
        const symbol = Symbol("hidden")
        const prototype = { inherited: "ignored" }
        const source = Object.assign(Object.create(prototype) as Record<PropertyKey, unknown>, {
            alpha: 1,
            beta: 2,
        })
        source[symbol] = 3
        Object.defineProperty(source, "nonEnumerable", {
            value: 4,
            enumerable: false,
        })

        const collection = collect(source as Record<string, unknown>)

        expect(collection.entries()).toEqual([
            ["alpha", 1],
            ["beta", 2],
        ])
    })

    test("collect(object) is shallow and preserves value references", () => {
        const nested = { enabled: true }
        const item = { title: "Original", nested }
        const source = { canvas: item }
        const collection = collect(source)

        item.title = "Changed after creation"
        nested.enabled = false

        expect(collection.get("canvas")).toBe(item)
        expect(collection.get("canvas")?.title).toBe("Changed after creation")
        expect(collection.get("canvas")?.nested).toBe(nested)
        expect(collection.get("canvas")?.nested.enabled).toBe(false)
    })

    test("collect(Map) preserves key identity, insertion order and values", () => {
        const objectKey = { id: 1 }
        const symbolKey = Symbol("token")
        const source = new Map<object | symbol | string, number>([
            [objectKey, 1],
            [symbolKey, 2],
            ["plain", 3],
        ])
        const collection = collect(source)

        source.clear()

        expect(collection.keys()).toEqual([objectKey, symbolKey, "plain"])
        expect(collection.items()).toEqual([1, 2, 3])
        expect(collection.get(objectKey)).toBe(1)
    })

    test("collect(entry iterable) consumes entries once and preserves their keys", () => {
        let iterations = 0
        function* entries(): Generator<readonly [string, number]> {
            iterations += 1
            yield ["first", 10] as const
            yield ["second", 20] as const
        }

        const collection = collect(entries())

        expect(iterations).toBe(1)
        expect(collection.entries()).toEqual([
            ["first", 10],
            ["second", 20],
        ])
    })

    test("collect(existing Collection) returns exactly the same instance", () => {
        const original = collect({ alpha: { value: 1 } })
        const collected = collect(original)

        expect(collected).toBe(original)
        expect(collected.toObject().alpha.value).toBe(1)
    })

    test("Collection constructor follows Map duplicate-key semantics", () => {
        const collection = new Collection([
            ["a", 1],
            ["b", 2],
            ["a", 3],
        ] as const)

        expect(collection.entries()).toEqual([
            ["a", 3],
            ["b", 2],
        ])
    })
})

describe("factory input hardening", () => {
    test("collect accepts null-prototype records", () => {
        const source = Object.create(null) as Record<string, number>
        source.alpha = 1
        source.beta = 2

        expect(collect(source).entries()).toEqual([
            ["alpha", 1],
            ["beta", 2],
        ])
    })

    test("collect accepts custom-prototype records but ignores inherited values", () => {
        const source = Object.create({ inherited: 1 }) as Record<string, number>
        source.own = 2

        expect(collect(source).entries()).toEqual([["own", 2]])
    })

    test("collect rejects unsupported primitive and structured object inputs", () => {
        class StructuredRecord {
            public alpha = 1
        }

        for (const value of [
            null,
            1,
            "entries",
            true,
            new Date(),
            /pattern/,
            new StructuredRecord(),
        ] as const) {
            expect(() => collect(value as never)).toThrow(TypeError)
        }
    })
})

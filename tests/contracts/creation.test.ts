import { describe, expect, test } from "bun:test"

import { Collection, collect, createCollection } from "../../dist/index.js"

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

    test("collect(object) uses enumerable own string properties in Object.entries order", () => {
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
        const original = collect([1, 2, 3])
        const collected = collect(original)

        expect(collected).toBe(original)
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

    test("collect(object) and createCollection(object) preserve intentionally different semantics", () => {
        const definition = {
            google: { label: "Google" },
            github: { label: "GitHub" },
        }
        const runtime = collect(definition)
        const defined = createCollection(definition)

        expect(runtime.get("google")).toBe(definition.google)
        expect(Object.prototype.hasOwnProperty.call(runtime, "google")).toBe(false)
        expect("id" in runtime.get("google")!).toBe(false)

        expect(defined.get("google")).toBe(defined.google)
        expect(defined.google.id).toBe("google")
        expect(Object.prototype.hasOwnProperty.call(defined, "google")).toBe(true)
    })

    test("createCollection injects canonical literal ids and replaces supplied ids", () => {
        const collection = createCollection({
            canvas: {
                id: "incorrect",
                title: "Canvas",
            },
            security: {
                title: "Security",
            },
        })

        expect(collection.canvas.id).toBe("canvas")
        expect(collection.security.id).toBe("security")
        expect(collection.get("canvas")).toBe(collection.canvas)
    })

    test("createCollection exposes safe keys as immutable direct properties", () => {
        const collection = createCollection({
            canvas: { title: "Canvas" },
        })
        const descriptor = Object.getOwnPropertyDescriptor(collection, "canvas")

        expect(descriptor?.enumerable).toBe(true)
        expect(descriptor?.writable).toBe(false)
        expect(descriptor?.configurable).toBe(false)
        expect(collection.canvas).toBe(collection.get("canvas"))
    })

    test("createCollection never shadows collection methods or Object members", () => {
        const collection = createCollection({
            map: { title: "Map item" },
            filter: { title: "Filter item" },
            count: { title: "Count item" },
            constructor: { title: "Constructor item" },
            toString: { title: "toString item" },
            safe: { title: "Safe item" },
        })

        expect(typeof collection.map).toBe("function")
        expect(typeof collection.filter).toBe("function")
        expect(typeof collection.count).toBe("function")
        expect(typeof collection.constructor).toBe("function")
        expect(typeof collection.toString).toBe("function")
        expect(collection.get("map")?.title).toBe("Map item")
        expect(collection.get("filter")?.title).toBe("Filter item")
        expect(collection.get("count")?.title).toBe("Count item")
        expect(collection.get("constructor")?.title).toBe("Constructor item")
        expect(collection.get("toString")?.title).toBe("toString item")
        expect(collection.safe.title).toBe("Safe item")
    })

    test("createCollection snapshots item top-level fields but intentionally stays shallow", () => {
        const nested = { enabled: true }
        const item = { title: "Original", nested }
        const definition = { canvas: item }
        const collection = createCollection(definition)

        item.title = "Changed after creation"
        nested.enabled = false

        expect(collection.canvas.title).toBe("Original")
        expect(collection.canvas.nested.enabled).toBe(false)
        expect(collection.canvas.nested).toBe(nested)
    })

    test("fluent transformations from a defined collection return regular collections", () => {
        const defined = createCollection({
            canvas: { enabled: true },
            security: { enabled: false },
        })
        const filtered = defined.filter((item) => item.enabled)

        expect(filtered).toBeInstanceOf(Collection)
        expect(filtered.entries()).toEqual([["canvas", defined.canvas]])
        expect(Object.prototype.hasOwnProperty.call(filtered, "canvas")).toBe(false)
    })
})

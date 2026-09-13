import { describe, expect, test } from "bun:test"

import { createCollection } from "../../dist/index.js"

describe("defined collection behavior", () => {
    test("definition keys are canonical ids even when an item provides id", () => {
        const collection = createCollection({
            alpha: { id: "wrong", title: "Alpha" },
        })

        expect(collection.alpha.id).toBe("alpha")
        expect(collection.get("alpha")?.id).toBe("alpha")
    })

    test("safe keys are exposed directly as readonly own properties", () => {
        const collection = createCollection({
            alpha: { title: "Alpha" },
            beta: { title: "Beta" },
        })
        const descriptor = Object.getOwnPropertyDescriptor(collection, "alpha")

        expect(collection.alpha.title).toBe("Alpha")
        expect(Object.keys(collection)).toEqual(["alpha", "beta"])
        expect(descriptor?.writable).toBe(false)
        expect(descriptor?.configurable).toBe(false)
        expect(descriptor?.enumerable).toBe(true)
    })

    test("runtime and Object prototype collisions never shadow methods", () => {
        const collection = createCollection({
            map: { title: "Map" },
            filter: { title: "Filter" },
            count: { title: "Count" },
            constructor: { title: "Constructor" },
            toString: { title: "ToString" },
            safe: { title: "Safe" },
        })

        expect(typeof collection.map).toBe("function")
        expect(typeof collection.filter).toBe("function")
        expect(typeof collection.count).toBe("function")
        expect(collection.get("map")?.title).toBe("Map")
        expect(collection.get("filter")?.title).toBe("Filter")
        expect(collection.get("count")?.title).toBe("Count")
        expect(collection.get("constructor")?.title).toBe("Constructor")
        expect(collection.get("toString")?.title).toBe("ToString")
        expect(collection.safe.title).toBe("Safe")
    })
})

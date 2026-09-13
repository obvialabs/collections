import { describe, expect, test } from "bun:test"

describe("built package exports", () => {
    test("root and subpath artifacts expose the intended entry points", async () => {
        const root = await import("../../dist/index.js")
        const collection = await import("../../dist/collection.js")
        const collect = await import("../../dist/collect.js")
        const createCollection = await import("../../dist/create-collection.js")

        expect(typeof root.Collection).toBe("function")
        expect(typeof root.collect).toBe("function")
        expect(typeof root.createCollection).toBe("function")
        expect(collection.Collection).toBe(root.Collection)
        expect(collect.collect).toBe(root.collect)
        expect(createCollection.createCollection).toBe(root.createCollection)
    })
})

import { describe, expect, test } from "bun:test"

import {
    Collection,
    CollectionItemNotFoundError,
    CollectionMultipleItemsError,
    collect,
    createCollection,
} from "../../dist/index.js"

describe("core collection behavior", () => {
    test("collect creates immutable keyed collections", () => {
        const source = new Map([["a", 1], ["b", 2]])
        const collection = collect(source)

        source.set("c", 3)

        expect(collection.keys()).toEqual(["a", "b"])
        expect(collection.items()).toEqual([1, 2])
        expect(collection.count()).toBe(2)
        expect(collection.empty()).toBe(false)
        expect(collection.notEmpty()).toBe(true)
    })

    test("createCollection injects literal ids and exposes safe direct keys", () => {
        const slides = createCollection({
            canvas: { title: "Canvas" },
            security: { title: "Security" },
            map: { title: "Map item" },
        })

        expect(slides.canvas.id).toBe("canvas")
        expect(slides.security.title).toBe("Security")
        expect(slides.get("map")?.id).toBe("map")
        expect(typeof slides.map).toBe("function")
    })

    test("getOr distinguishes missing keys from undefined values", () => {
        const collection = new Collection<string, string | undefined>([["defined", undefined]])

        expect(collection.has("defined")).toBe(true)
        expect(collection.getOr("defined", "fallback")).toBeUndefined()
        expect(collection.getOr("missing", "fallback")).toBe("fallback")
    })

    test("first, last and sole resolve or throw predictably", () => {
        const collection = collect([1, 2, 3])

        expect(collection.first()).toBe(1)
        expect(collection.last()).toBe(3)
        expect(collection.sole((value) => value === 2)).toBe(2)
        expect(() => collection.sole((value) => value > 1)).toThrow(CollectionMultipleItemsError)
        expect(() => collection.firstOrFail((value) => value > 10)).toThrow(CollectionItemNotFoundError)
    })

    test("iteration yields key/value entries", () => {
        const collection = collect(new Map([["a", 1], ["b", 2]]))
        expect([...collection]).toEqual([["a", 1], ["b", 2]])
    })
})

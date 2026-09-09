import assert from "node:assert/strict"
import test from "node:test"

import {
    Collection,
    CollectionItemNotFoundError,
    CollectionMultipleItemsError,
    collect,
    createCollection,
} from "../../dist/index.js"

test("collect creates immutable keyed collections", () => {
    const source = new Map([["a", 1], ["b", 2]])
    const collection = collect(source)

    source.set("c", 3)

    assert.deepEqual(collection.keys(), ["a", "b"])
    assert.deepEqual(collection.items(), [1, 2])
    assert.equal(collection.count(), 2)
    assert.equal(collection.empty(), false)
    assert.equal(collection.notEmpty(), true)
})

test("createCollection injects literal ids and exposes safe direct keys", () => {
    const slides = createCollection({
        canvas: { title: "Canvas" },
        security: { title: "Security" },
        map: { title: "Map item" },
    })

    assert.equal(slides.canvas.id, "canvas")
    assert.equal(slides.security.title, "Security")
    assert.equal(slides.get("map")?.id, "map")
    assert.equal(typeof slides.map, "function")
})

test("getOr distinguishes missing keys from undefined values", () => {
    const collection = new Collection([["defined", undefined]])

    assert.equal(collection.has("defined"), true)
    assert.equal(collection.getOr("defined", "fallback"), undefined)
    assert.equal(collection.getOr("missing", "fallback"), "fallback")
})

test("first, last and sole resolve or throw predictably", () => {
    const collection = collect([1, 2, 3])

    assert.equal(collection.first(), 1)
    assert.equal(collection.last(), 3)
    assert.equal(collection.sole((value) => value === 2), 2)
    assert.throws(() => collection.sole((value) => value > 1), CollectionMultipleItemsError)
    assert.throws(() => collection.firstOrFail((value) => value > 10), CollectionItemNotFoundError)
})

test("iteration yields key/value entries", () => {
    const collection = collect(new Map([["a", 1], ["b", 2]]))
    assert.deepEqual([...collection], [["a", 1], ["b", 2]])
})

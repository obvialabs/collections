import assert from "node:assert/strict"
import test from "node:test"

import { collect } from "../../dist/index.js"

test("take and skip predicate variants preserve sequence", () => {
    const values = collect([1, 2, 3, 4, 5])

    assert.deepEqual(values.takeUntil((value) => value === 4).items(), [1, 2, 3])
    assert.deepEqual(values.takeWhile((value) => value < 4).items(), [1, 2, 3])
    assert.deepEqual(values.skipUntil((value) => value === 3).items(), [3, 4, 5])
    assert.deepEqual(values.skipWhile((value) => value < 3).items(), [3, 4, 5])
})

test("chunk, sliding, split and partition return nested collections", () => {
    const values = collect([1, 2, 3, 4, 5])

    assert.deepEqual(values.chunk(2).map((chunk) => chunk.items()).items(), [[1, 2], [3, 4], [5]])
    assert.deepEqual(values.sliding(3, 2).map((window) => window.items()).items(), [[1, 2, 3], [3, 4, 5]])
    assert.deepEqual(values.split(2).map((group) => group.items()).items(), [[1, 2, 3], [4, 5]])

    const [even, odd] = values.partition((value) => value % 2 === 0)
    assert.deepEqual(even.items(), [2, 4])
    assert.deepEqual(odd.items(), [1, 3, 5])
})

test("set and key-set operations preserve original entries", () => {
    const values = collect(new Map([["a", 1], ["b", 2], ["c", 2]]))

    assert.deepEqual(values.unique().entries(), [["a", 1], ["b", 2]])
    assert.deepEqual(values.duplicates().entries(), [["c", 2]])
    assert.deepEqual(values.diff([2]).keys(), ["a"])
    assert.deepEqual(values.intersect([2]).keys(), ["b", "c"])
    assert.deepEqual(values.diffKeys(["b"]).keys(), ["a", "c"])
    assert.deepEqual(values.intersectByKeys(["a", "c"]).keys(), ["a", "c"])
})

test("merge, replace, with and remove are immutable", () => {
    const source = collect(new Map([["a", 1], ["b", 2]]))
    const merged = source.merge([["b", 20], ["c", 30]])

    assert.deepEqual(source.entries(), [["a", 1], ["b", 2]])
    assert.deepEqual(merged.entries(), [["a", 1], ["b", 20], ["c", 30]])
    assert.deepEqual(source.replace([["b", 7], ["missing", 9]]).entries(), [["a", 1], ["b", 7]])
    assert.equal(source.with("c", 3).get("c"), 3)
    assert.equal(source.remove("a").has("a"), false)
})

test("zip, crossJoin and pad produce numeric collections", () => {
    assert.deepEqual(collect([1, 2]).zip(["a"]).items(), [[1, "a"], [2, undefined]])
    assert.deepEqual(collect([1, 2]).crossJoin(["a", "b"]).items(), [[1, "a"], [1, "b"], [2, "a"], [2, "b"]])
    assert.deepEqual(collect([1, 2]).pad(4, 0).items(), [1, 2, 0, 0])
    assert.deepEqual(collect([1, 2]).pad(-4, 0).items(), [0, 0, 1, 2])
})

test("aggregates and string helpers produce native values", () => {
    const values = collect([1, 2, 2, 4])

    assert.equal(values.sum(), 9)
    assert.equal(values.average(), 2.25)
    assert.equal(values.avg(), 2.25)
    assert.equal(values.min(), 1)
    assert.equal(values.max(), 4)
    assert.equal(values.median(), 2)
    assert.deepEqual(values.mode(), [2])
    assert.equal(values.join(", ", " and "), "1, 2, 2 and 4")
})

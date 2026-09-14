import { describe, expect, test } from "bun:test"

import { collect } from "#collections"

const values = collect([1, 2, 3, 4, 5])

describe("argument guards", () => {
    test("size and step operations reject zero, negatives and fractions", () => {
        expect(() => values.chunk(0)).toThrow(RangeError)
        expect(() => values.chunk(-1)).toThrow(RangeError)
        expect(() => values.chunk(1.5)).toThrow(RangeError)
        expect(() => values.sliding(0)).toThrow(RangeError)
        expect(() => values.sliding(2, 0)).toThrow(RangeError)
        expect(() => values.split(0)).toThrow(RangeError)
        expect(() => values.nth(0)).toThrow(RangeError)
        expect(() => values.nth(2, -1)).toThrow(RangeError)
        expect(() => values.nth(2, 1.5)).toThrow(RangeError)
    })

    test("flatten only accepts non-negative integer depth or Infinity", () => {
        expect(() => values.flatten(-1)).toThrow(RangeError)
        expect(() => values.flatten(Number.NaN)).toThrow(RangeError)
        expect(() => values.flatten(1.5)).toThrow(RangeError)
        expect(() => values.flatten(Number.NEGATIVE_INFINITY)).toThrow(RangeError)
        expect(() => values.flatten(Number.POSITIVE_INFINITY)).not.toThrow()
    })

    test("count-like sequence arguments reject silent truncation", () => {
        expect(() => values.take(1.5)).toThrow(RangeError)
        expect(() => values.skip(1.5)).toThrow(RangeError)
        expect(() => values.slice(1.5)).toThrow(RangeError)
        expect(() => values.slice(1, -1)).toThrow(RangeError)
        expect(() => values.slice(1, 1.5)).toThrow(RangeError)
        expect(() => values.pad(3.5, 0)).toThrow(RangeError)
    })

    test("random count cannot be invalid or exceed collection size", () => {
        expect(() => values.random(-1)).toThrow(RangeError)
        expect(() => values.random(1.5)).toThrow(RangeError)
        expect(() => values.random(6)).toThrow(RangeError)
        expect(values.random(0).empty()).toBe(true)
    })
})

describe("high-value feature guards", () => {
    test("page, splitIn and multiply arguments reject invalid counts", () => {
        expect(() => values.forPage(0, 2)).toThrow(RangeError)
        expect(() => values.forPage(1, 0)).toThrow(RangeError)
        expect(() => values.forPage(1.5, 2)).toThrow(RangeError)
        expect(() => values.splitIn(0)).toThrow(RangeError)
        expect(() => values.splitIn(1.5)).toThrow(RangeError)
        expect(() => values.multiply(-1)).toThrow(RangeError)
        expect(() => values.multiply(1.5)).toThrow(RangeError)
    })

    test("dot rejects invalid depths, symbol keys and cycles", () => {
        expect(() => values.dot(-1)).toThrow(RangeError)
        expect(() => values.dot(1.5)).toThrow(RangeError)
        expect(() => values.dot(Number.NaN)).toThrow(RangeError)
        expect(() => collect(new Map([[Symbol("x"), 1]])).dot()).toThrow(TypeError)

        const cyclic: Record<string, unknown> = {}
        cyclic.self = cyclic
        expect(() => collect({ cyclic }).dot()).toThrow(TypeError)
    })

    test("undot rejects keys that cannot be represented in dot notation", () => {
        expect(() => collect(new Map([[Symbol("x"), 1]])).undot()).toThrow(TypeError)
    })

    test("collapseWithKeys rejects nested sources that do not yield entry tuples", () => {
        const malformed = collect([[1, 2, 3]]) as any
        expect(() => malformed.collapseWithKeys()).toThrow(TypeError)
    })

    test("reduceSpread rejects reducers that stop returning tuple-like state", () => {
        const source = collect([1, 2, 3])
        expect(() => source.reduceSpread(((sum: number) => sum + 1) as any, 0)).toThrow(TypeError)
    })

    test("percentage precision must be an integer", () => {
        expect(() => values.percentage(() => true, 1.5)).toThrow(RangeError)
        expect(() => values.percentage(() => true, Number.NaN)).toThrow(RangeError)
    })
})

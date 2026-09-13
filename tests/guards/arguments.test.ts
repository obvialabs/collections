import { describe, expect, test } from "bun:test"

import { collect } from "../../dist/index.js"

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

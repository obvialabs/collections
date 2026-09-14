import { describe, expect, test } from "bun:test"

import {
    Collection,
    CollectionItemNotFoundError,
    CollectionMultipleItemsError,
    collect,
} from "#collections"

describe("errors and invalid-input contracts", () => {
    test("package selection errors have stable class names and default messages", () => {
        const missing = new CollectionItemNotFoundError()
        const multiple = new CollectionMultipleItemsError()

        expect(missing).toBeInstanceOf(Error)
        expect(missing.name).toBe("CollectionItemNotFoundError")
        expect(missing.message).toBe("Collection item was not found.")
        expect(multiple).toBeInstanceOf(Error)
        expect(multiple.name).toBe("CollectionMultipleItemsError")
        expect(multiple.message).toBe("Collection contains more than one matching item.")
    })

    test("package errors preserve custom messages", () => {
        expect(new CollectionItemNotFoundError("missing user").message).toBe("missing user")
        expect(new CollectionMultipleItemsError("too many users").message).toBe("too many users")
    })

    test("firstOrFail, lastOrFail and sole throw package-specific errors only for their documented states", () => {
        const empty = collect([] as number[])
        const many = collect([1, 2])

        expect(() => empty.firstOrFail()).toThrow(CollectionItemNotFoundError)
        expect(() => empty.lastOrFail()).toThrow(CollectionItemNotFoundError)
        expect(() => empty.sole()).toThrow(CollectionItemNotFoundError)
        expect(() => many.sole()).toThrow(CollectionMultipleItemsError)
    })

    test("positive-size arguments reject zero, negatives, fractions, NaN and infinities", () => {
        const source = collect([1, 2, 3])
        const invalid = [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]

        for (const value of invalid) {
            expect(() => source.chunk(value)).toThrow(RangeError)
            expect(() => source.sliding(value)).toThrow(RangeError)
            expect(() => source.split(value)).toThrow(RangeError)
            expect(() => source.nth(value)).toThrow(RangeError)
        }
    })

    test("sliding step rejects invalid positive-integer values independently of size", () => {
        const source = collect([1, 2, 3])

        for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(() => source.sliding(2, value)).toThrow(RangeError)
        }
    })

    test("nth offset requires a non-negative integer", () => {
        const source = collect([1, 2, 3])

        for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(() => source.nth(2, value)).toThrow(RangeError)
        }
    })

    test("take and skip require integers but deliberately accept negative integers", () => {
        const source = collect([1, 2, 3])

        for (const value of [1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
            expect(() => source.take(value)).toThrow(RangeError)
            expect(() => source.skip(value)).toThrow(RangeError)
        }

        expect(() => source.take(-1)).not.toThrow()
        expect(() => source.skip(-1)).not.toThrow()
    })

    test("slice offset must be an integer and length must be a non-negative integer", () => {
        const source = collect([1, 2, 3])

        for (const value of [1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
            expect(() => source.slice(value)).toThrow(RangeError)
        }
        for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(() => source.slice(0, value)).toThrow(RangeError)
        }
    })

    test("pad size requires an integer and accepts both directions", () => {
        const source = collect([1, 2])

        for (const value of [1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
            expect(() => source.pad(value, 0)).toThrow(RangeError)
        }
        expect(() => source.pad(3, 0)).not.toThrow()
        expect(() => source.pad(-3, 0)).not.toThrow()
    })

    test("flatten depth accepts zero, positive integers and Infinity only", () => {
        const source = collect([[1], [2]])

        for (const value of [-1, 1.5, Number.NaN, Number.NEGATIVE_INFINITY]) {
            expect(() => source.flatten(value)).toThrow(RangeError)
        }
        expect(() => source.flatten(0)).not.toThrow()
        expect(() => source.flatten(2)).not.toThrow()
        expect(() => source.flatten(Number.POSITIVE_INFINITY)).not.toThrow()
    })

    test("random count requires a non-negative integer and cannot exceed collection size", () => {
        const source = collect([1, 2, 3])

        for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(() => source.random(value)).toThrow(RangeError)
        }
        expect(() => source.random(4)).toThrow(RangeError)
        expect(() => source.random(3)).not.toThrow()
        expect(() => source.random(0)).not.toThrow()
    })

    test("toObject refuses object, function and bigint keys rather than coercing them", () => {
        const cases: unknown[] = [{}, () => undefined, 10n]

        for (const key of cases) {
            const collection = new Collection<unknown, string>([[key, "value"]])
            expect(() => collection.toObject()).toThrow(TypeError)
        }
    })
})

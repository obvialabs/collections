import { describe, expect, test } from "bun:test"

import {
    Collection,
    CollectionItemNotFoundError,
    CollectionMultipleItemsError,
    collect,
} from "../../dist/index.js"

describe("failure semantics", () => {
    test("required selection methods use package-specific errors", () => {
        const empty = collect([] as number[])
        const many = collect([1, 2])

        expect(() => empty.firstOrFail()).toThrow(CollectionItemNotFoundError)
        expect(() => empty.lastOrFail()).toThrow(CollectionItemNotFoundError)
        expect(() => empty.sole()).toThrow(CollectionItemNotFoundError)
        expect(() => many.sole()).toThrow(CollectionMultipleItemsError)
    })

    test("toObject rejects keys that are not JavaScript property keys", () => {
        const collection = new Collection<object, number>([[{}, 1]])
        expect(() => collection.toObject()).toThrow(TypeError)
    })

    test("empty collections return absence instead of inventing values", () => {
        const empty = collect([] as number[])

        expect(empty.first()).toBeUndefined()
        expect(empty.last()).toBeUndefined()
        expect(empty.random()).toBeUndefined()
        expect(empty.search(1)).toBeUndefined()
        expect(empty.average()).toBeUndefined()
        expect(empty.median()).toBeUndefined()
        expect(empty.min()).toBeUndefined()
        expect(empty.max()).toBeUndefined()
    })

    test("predicate helpers short-circuit and do not invoke later items", () => {
        const values = collect([1, 2, 3, 4])
        const someVisited: number[] = []
        const everyVisited: number[] = []

        expect(values.some((value) => {
            someVisited.push(value)
            return value === 2
        })).toBe(true)
        expect(values.every((value) => {
            everyVisited.push(value)
            return value < 2
        })).toBe(false)

        expect(someVisited).toEqual([1, 2])
        expect(everyVisited).toEqual([1, 2])
    })
})

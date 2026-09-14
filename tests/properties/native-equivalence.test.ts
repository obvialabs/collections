import { describe, expect, test } from "bun:test"

import { collect } from "#collections"

function createRandom(seed: number): () => number {
    let state = seed >>> 0

    return () => {
        state = (state * 1664525 + 1013904223) >>> 0
        return state / 0x1_0000_0000
    }
}

function normalizeSliceStart(length: number, offset: number): number {
    return offset < 0
        ? Math.max(length + offset, 0)
        : Math.min(offset, length)
}

describe("property-style native equivalence", () => {
    test("common value transforms agree with native arrays across generated inputs", () => {
        const random = createRandom(0x0b71a)

        for (let caseIndex = 0; caseIndex < 120; caseIndex += 1) {
            const length = Math.floor(random() * 40)
            const values = Array.from({ length }, () => Math.floor(random() * 41) - 20)
            const collection = collect(values)
            const take = Math.floor(random() * 12)
            const offset = Math.floor(random() * (length + 10)) - Math.floor((length + 10) / 2)
            const sliceLength = Math.floor(random() * 10)
            const start = normalizeSliceStart(length, offset)

            expect(collection.map((value) => value * 3).items()).toEqual(values.map((value) => value * 3))
            expect(collection.filter((value) => value % 2 === 0).items()).toEqual(values.filter((value) => value % 2 === 0))
            expect(collection.reject((value) => value < 0).items()).toEqual(values.filter((value) => value >= 0))
            expect(collection.reverse().items()).toEqual([...values].reverse())
            expect(collection.take(take).items()).toEqual(values.slice(0, take))
            expect(collection.take(-take).items()).toEqual(take === 0 ? [] : values.slice(-take))
            expect(collection.skip(take).items()).toEqual(values.slice(take))
            expect(collection.slice(offset, sliceLength).items()).toEqual(values.slice(start, start + sliceLength))
            expect(collection.sum()).toBe(values.reduce((sum, value) => sum + value, 0))
        }
    })

    test("chunking, partitioning and uniqueness never lose or invent values", () => {
        const random = createRandom(0xc011ec7)

        for (let caseIndex = 0; caseIndex < 80; caseIndex += 1) {
            const length = 1 + Math.floor(random() * 50)
            const values = Array.from({ length }, () => Math.floor(random() * 10))
            const collection = collect(values)
            const chunkSize = 1 + Math.floor(random() * 8)
            const [even, odd] = collection.partition((value) => value % 2 === 0)

            expect(collection.chunk(chunkSize).flatMap((chunk) => chunk.items()).items()).toEqual(values)
            expect(even.items()).toEqual(values.filter((value) => value % 2 === 0))
            expect(odd.items()).toEqual(values.filter((value) => value % 2 !== 0))
            expect(collection.unique().items()).toEqual([...new Set(values)])
            expect(collection.items()).toEqual(values)
        }
    })
})

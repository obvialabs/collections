import { describe, expect, test } from "bun:test"

import { collect } from "#collections"

function randomFactory(seed: number): () => number {
    let state = seed >>> 0

    return () => {
        state = (state * 1664525 + 1013904223) >>> 0
        return state / 0x1_0000_0000
    }
}

function generatedNumbers(random: () => number, maxLength = 80): number[] {
    const length = Math.floor(random() * maxLength)
    return Array.from({ length }, () => Math.floor(random() * 101) - 50)
}

describe("collection algebra and generated-input properties", () => {
    test("reverse is an involution and values are conserved", () => {
        const random = randomFactory(0x51de)

        for (let index = 0; index < 250; index += 1) {
            const values = generatedNumbers(random)
            const collection = collect(values)

            expect(collection.reverse().reverse().entries()).toEqual(collection.entries())
            expect(collection.reverse().count()).toBe(collection.count())
        }
    })

    test("filter and reject form an ordered partition of every generated input", () => {
        const random = randomFactory(0xf117e7)

        for (let index = 0; index < 250; index += 1) {
            const values = generatedNumbers(random)
            const collection = collect(values)
            const accepted = collection.filter((value) => value >= 0)
            const rejected = collection.reject((value) => value >= 0)

            expect(accepted.items()).toEqual(values.filter((value) => value >= 0))
            expect(rejected.items()).toEqual(values.filter((value) => value < 0))
            expect(accepted.count() + rejected.count()).toBe(collection.count())
        }
    })

    test("unique is idempotent and preserves first occurrence order", () => {
        const random = randomFactory(0x0A11CE)

        for (let index = 0; index < 200; index += 1) {
            const values = generatedNumbers(random).map((value) => value % 10)
            const collection = collect(values)
            const unique = collection.unique()

            const expected: number[] = []
            const seen = new Set<number>()
            for (const value of values) {
                if (seen.has(value)) continue
                seen.add(value)
                expected.push(value)
            }

            expect(unique.items()).toEqual(expected)
            expect(unique.unique().entries()).toEqual(unique.entries())
        }
    })

    test("chunk then flatMap reconstructs every generated input", () => {
        const random = randomFactory(0xc84a)

        for (let index = 0; index < 200; index += 1) {
            const values = generatedNumbers(random)
            const size = 1 + Math.floor(random() * 12)
            const reconstructed = collect(values)
                .chunk(size)
                .flatMap((chunk) => chunk.items())
                .items()

            expect(reconstructed).toEqual(values)
        }
    })

    test("split then flatMap reconstructs every generated non-empty input", () => {
        const random = randomFactory(0x5A117)

        for (let index = 0; index < 200; index += 1) {
            const values = generatedNumbers(random).concat(index)
            const groups = 1 + Math.floor(random() * 20)
            const reconstructed = collect(values)
                .split(groups)
                .flatMap((group) => group.items())
                .items()

            expect(reconstructed).toEqual(values)
        }
    })

    test("sorting numeric values agrees with native stable sort", () => {
        const random = randomFactory(0x5077)

        for (let index = 0; index < 200; index += 1) {
            const values = generatedNumbers(random)
            const expected = [...values].sort((left, right) => left - right)

            expect(collect(values).sort((left, right) => left - right).items()).toEqual(expected)
            expect(collect(values).sortBy((value) => value).items()).toEqual(expected)
        }
    })

    test("take, skip and slice match their documented array-equivalent semantics", () => {
        const random = randomFactory(0x511ce)

        for (let index = 0; index < 300; index += 1) {
            const values = generatedNumbers(random)
            const collection = collect(values)
            const amount = Math.floor(random() * 30)
            const signedAmount = random() < 0.5 ? amount : -amount
            const offsetMagnitude = Math.floor(random() * (values.length + 20))
            const offset = random() < 0.5 ? offsetMagnitude : -offsetMagnitude
            const length = Math.floor(random() * 20)
            const start = offset < 0
                ? Math.max(values.length + offset, 0)
                : Math.min(offset, values.length)

            const expectedTake = signedAmount === 0
                ? []
                : signedAmount > 0
                    ? values.slice(0, signedAmount)
                    : values.slice(signedAmount)
            const expectedSkip = signedAmount >= 0
                ? values.slice(signedAmount)
                : values.slice(0, Math.max(0, values.length + signedAmount))

            expect(collection.take(signedAmount).items()).toEqual(expectedTake)
            expect(collection.skip(signedAmount).items()).toEqual(expectedSkip)
            expect(collection.slice(offset, length).items()).toEqual(values.slice(start, start + length))
        }
    })


    test("map identity preserves every generated entry and key", () => {
        const random = randomFactory(0x1D3A71)

        for (let index = 0; index < 200; index += 1) {
            const values = generatedNumbers(random)
            const collection = collect(values)

            expect(collection.map((value) => value).entries()).toEqual(collection.entries())
            expect(collection.values().items()).toEqual(collection.items())
        }
    })

    test("take and skip reconstruct generated inputs for non-negative split points", () => {
        const random = randomFactory(0x7A4E5A1)

        for (let index = 0; index < 250; index += 1) {
            const values = generatedNumbers(random)
            const split = Math.floor(random() * (values.length + 10))
            const collection = collect(values)
            const reconstructed = [
                ...collection.take(split).items(),
                ...collection.skip(split).items(),
            ]

            expect(reconstructed).toEqual(values)
        }
    })

    test("diff and intersect partition membership against generated sets", () => {
        const random = randomFactory(0xD1FF1A7)

        for (let index = 0; index < 200; index += 1) {
            const values = generatedNumbers(random)
            const accepted = new Set(generatedNumbers(random, 25))
            const collection = collect(values)
            const inside = collection.intersect(accepted)
            const outside = collection.diff(accepted)

            expect(inside.items()).toEqual(values.filter((value) => accepted.has(value)))
            expect(outside.items()).toEqual(values.filter((value) => !accepted.has(value)))
            expect(inside.count() + outside.count()).toBe(collection.count())
        }
    })

    test("empty set updates are identity operations on observable entries", () => {
        const random = randomFactory(0xE0471)

        for (let index = 0; index < 150; index += 1) {
            const values = generatedNumbers(random)
            const collection = collect(values)

            expect(collection.union([]).entries()).toEqual(collection.entries())
            expect(collection.merge([]).entries()).toEqual(collection.entries())
            expect(collection.replace([]).entries()).toEqual(collection.entries())
        }
    })

    test("immutable updates never mutate the generated source collection", () => {
        const random = randomFactory(0x1AA77AB1)

        for (let index = 0; index < 150; index += 1) {
            const values = generatedNumbers(random, 30)
            const source = collect(values)
            const snapshot = source.entries()

            source.map((value) => value * 2)
            source.filter((value) => value > 0)
            source.reverse()
            source.sort((left, right) => left - right)
            source.with("extra", 1)
            source.append(99)
            source.prepend(99)
            source.remove(0)

            expect(source.entries()).toEqual(snapshot)
        }
    })
})

describe("high-value operation properties", () => {
    test("splitIn then flatMap reconstructs generated inputs in order", () => {
        const random = randomFactory(0x5A1171)

        for (let index = 0; index < 200; index += 1) {
            const values = generatedNumbers(random)
            const groups = 1 + Math.floor(random() * 20)
            const reconstructed = collect(values)
                .splitIn(groups)
                .flatMap((group) => group.items())
                .items()

            expect(reconstructed).toEqual(values)
        }
    })

    test("multiply repeats the source sequence exactly multiplier times", () => {
        const random = randomFactory(0xA1171)

        for (let index = 0; index < 150; index += 1) {
            const values = generatedNumbers(random, 30)
            const multiplier = Math.floor(random() * 6)
            const expected = Array.from({ length: multiplier }, () => values).flat()

            expect(collect(values).multiply(multiplier).items()).toEqual(expected)
        }
    })

    test("assoc intersection and difference form an ordered partition by exact key/value pair", () => {
        const random = randomFactory(0xA550C)

        for (let index = 0; index < 150; index += 1) {
            const values = generatedNumbers(random, 30)
            const collection = collect(new Map(values.map((value, key) => [key, value] as const)))
            const other = new Map(collection.entries().filter(([, value]) => value >= 0))
            const inside = collection.intersectAssoc(other)
            const outside = collection.diffAssoc(other)

            expect(inside.count() + outside.count()).toBe(collection.count())
            expect(inside.entries()).toEqual(collection.entries().filter(([key, value]) => other.has(key) && Object.is(other.get(key), value)))
            expect(outside.entries()).toEqual(collection.entries().filter(([key, value]) => !other.has(key) || !Object.is(other.get(key), value)))
        }
    })

    test("safe dot paths are stable across dot -> undot -> dot", () => {
        const source = collect({
            user: {
                profile: { name: "Ada", score: 42 },
                active: true,
            },
            settings: { theme: "dark" },
        })
        const dotted = source.dot()

        expect(dotted.undot().dot().entries()).toEqual(dotted.entries())
    })

    test("concat count and ordering equal the concatenation of source values", () => {
        const random = randomFactory(0xC0A7)

        for (let index = 0; index < 150; index += 1) {
            const left = generatedNumbers(random, 30)
            const right = generatedNumbers(random, 30)
            const concatenated = collect(left).concat(right)

            expect(concatenated.items()).toEqual([...left, ...right])
            expect(concatenated.count()).toBe(left.length + right.length)
        }
    })
})

import { describe, expect, test } from "bun:test"

import { Collection, collect } from "../../dist/index.js"

describe("edge semantics and non-obvious contracts", () => {
    test("entry snapshots can be mutated without changing the collection", () => {
        const source = collect(new Map([
            ["a", { value: 1 }],
            ["b", { value: 2 }],
        ]))
        const entries = source.entries() as Array<[string, { value: number }]>

        entries[0]![0] = "changed"
        entries[0]![1] = { value: 99 }

        expect(source.keys()).toEqual(["a", "b"])
        expect(source.get("a")?.value).toBe(1)
    })

    test("object-source keys stay independent from Collection member names", () => {
        const collection = collect({
            safe: { label: "Safe" },
            map: { label: "Map" },
            constructor: { label: "Constructor" },
        })

        expect(Object.keys(collection)).toEqual([])
        expect(collection.keys()).toEqual(["safe", "map", "constructor"])
        expect(collection.get("map")?.label).toBe("Map")
        expect(collection.get("constructor")?.label).toBe("Constructor")
        expect(collection.toObject().safe.label).toBe("Safe")
    })

    test("flatten(0) preserves each top-level value as one value while reindexing", () => {
        const first = [1, 2]
        const second = new Set([3, 4])
        const flattened = collect(new Map<string, number[] | Set<number>>([
            ["first", first],
            ["second", second],
        ])).flatten(0)

        expect(flattened.entries()).toEqual([
            [0, first],
            [1, second],
        ])
    })

    test("whereIn and whereNotIn consume their candidate iterable once", () => {
        let reads = 0
        function* accepted(): Generator<number> {
            reads += 1
            yield 1
            yield 3
        }

        const source = collect([
            { score: 1 },
            { score: 2 },
            { score: 3 },
        ] as Array<{ score: number }>)

        expect(source.whereIn("score", accepted()).keys()).toEqual([0, 2])
        expect(reads).toBe(1)

        reads = 0
        expect(source.whereNotIn("score", accepted()).keys()).toEqual([1])
        expect(reads).toBe(1)
    })

    test("grouping supports undefined, NaN and object identity as Map keys", () => {
        const object = { id: "shared" }
        const source = collect([
            { group: undefined as undefined | number | object },
            { group: Number.NaN as undefined | number | object },
            { group: Number.NaN as undefined | number | object },
            { group: object as undefined | number | object },
            { group: object as undefined | number | object },
        ])
        const grouped = source.groupBy("group")

        expect(grouped.count()).toBe(3)
        expect(grouped.get(undefined)?.count()).toBe(1)
        expect(grouped.get(Number.NaN)?.count()).toBe(2)
        expect(grouped.get(object)?.count()).toBe(2)
    })

    test("union, merge and replace consume a one-shot entry iterable exactly once", () => {
        const source = collect(new Map([["a", 1]]))

        for (const operation of [
            (entries: Iterable<readonly [string, number]>) => source.union(entries),
            (entries: Iterable<readonly [string, number]>) => source.merge(entries),
            (entries: Iterable<readonly [string, number]>) => source.replace(entries),
        ]) {
            let starts = 0
            function* entries(): Generator<readonly [string, number]> {
                starts += 1
                yield ["a", 2] as const
                yield ["b", 3] as const
            }

            operation(entries())
            expect(starts).toBe(1)
        }
    })

    test("zip and crossJoin materialize a one-shot right iterable only once", () => {
        for (const operation of [
            (values: Iterable<string>) => collect([1, 2]).zip(values),
            (values: Iterable<string>) => collect([1, 2]).crossJoin(values),
        ]) {
            let starts = 0
            function* values(): Generator<string> {
                starts += 1
                yield "a"
                yield "b"
            }

            operation(values())
            expect(starts).toBe(1)
        }
    })

    test("random(0) returns an empty collection without reading random state", () => {
        const originalRandom = Math.random
        let calls = 0

        Math.random = () => {
            calls += 1
            return 0.5
        }

        try {
            const sample = collect([1, 2, 3]).random(0)

            expect(sample).toBeInstanceOf(Collection)
            expect(sample.empty()).toBe(true)
            expect(calls).toBe(0)
        } finally {
            Math.random = originalRandom
        }
    })

    test("shuffle keeps key/value associations even with deterministic random values", () => {
        const originalRandom = Math.random
        const randomValues = [0, 0.99, 0.25]
        let index = 0

        Math.random = () => randomValues[index++] ?? 0

        try {
            const source = collect(new Map([
                ["a", 1],
                ["b", 2],
                ["c", 3],
                ["d", 4],
            ]))
            const shuffled = source.shuffle()

            expect(new Map(shuffled).get("a")).toBe(1)
            expect(new Map(shuffled).get("b")).toBe(2)
            expect(new Map(shuffled).get("c")).toBe(3)
            expect(new Map(shuffled).get("d")).toBe(4)
            expect(shuffled.count()).toBe(4)
        } finally {
            Math.random = originalRandom
        }
    })

    test("append never replaces NaN or infinite numeric keys", () => {
        const source = new Collection<number | string, string>([
            [Number.NaN, "nan"],
            [Number.POSITIVE_INFINITY, "infinity"],
            ["name", "named"],
        ])
        const appended = source.append("next")

        expect(appended.get(Number.NaN)).toBe("nan")
        expect(appended.get(Number.POSITIVE_INFINITY)).toBe("infinity")
        expect(appended.get(0)).toBe("next")
        expect(appended.count()).toBe(source.count() + 1)
    })

    test("append falls back to a free numeric key when floating-point precision has no successor", () => {
        const source = new Collection<number, string>([
            [0, "zero"],
            [1, "one"],
            [Number.MAX_VALUE, "max"],
        ])
        const appended = source.append("next")

        expect(appended.get(Number.MAX_VALUE)).toBe("max")
        expect(appended.get(2)).toBe("next")
        expect(appended.count()).toBe(4)
    })

    test("min and max follow the same deterministic nullish and NaN ordering as sortBy", () => {
        const values = collect([undefined, 2, Number.NaN, null, 1] as Array<number | null | undefined>)

        expect(values.min()).toBeNull()
        expect(Number.isNaN(values.max() as number)).toBe(true)
    })

    test("mode uses Map identity semantics and preserves first-seen tie order", () => {
        const first = { id: 1 }
        const second = { id: 1 }
        const values = collect([first, second, first, second])

        expect(values.mode()).toEqual([first, second])
    })

    test("implode stringifies missing optional path values rather than skipping entries", () => {
        const values = collect([
            { profile: { email: "ada@example.com" } },
            {} as { profile?: { email: string } },
        ] as Array<{ profile?: { email: string } }>)

        expect(values.implode("profile.email", ",")).toBe("ada@example.com,undefined")
    })
})

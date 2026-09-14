import { describe, expect, test } from "bun:test"

import { collect } from "#collections"

function range(size: number): number[] {
    return Array.from({ length: size }, (_, index) => index)
}

describe("performance characteristics expressed as observable work", () => {
    test("single-pass transforms invoke their callback exactly once per source entry", () => {
        const source = collect(range(2_000))

        for (const operation of [
            (counter: { calls: number }) => source.map((value) => {
                counter.calls += 1
                return value
            }),
            (counter: { calls: number }) => source.mapValues((value) => {
                counter.calls += 1
                return value
            }),
            (counter: { calls: number }) => source.mapKeys((value) => {
                counter.calls += 1
                return value
            }),
            (counter: { calls: number }) => source.mapWithKeys((value) => {
                counter.calls += 1
                return [value, value] as const
            }),
            (counter: { calls: number }) => source.filter(() => {
                counter.calls += 1
                return true
            }),
            (counter: { calls: number }) => source.reject(() => {
                counter.calls += 1
                return false
            }),
            (counter: { calls: number }) => source.keyBy((value) => {
                counter.calls += 1
                return value
            }),
            (counter: { calls: number }) => source.groupBy((value) => {
                counter.calls += 1
                return value % 10
            }),
            (counter: { calls: number }) => source.countBy((value) => {
                counter.calls += 1
                return value % 10
            }),
            (counter: { calls: number }) => source.partition(() => {
                counter.calls += 1
                return true
            }),
            (counter: { calls: number }) => source.reduce((carry, value) => {
                counter.calls += 1
                return carry + value
            }, 0),
        ]) {
            const counter = { calls: 0 }
            operation(counter)
            expect(counter.calls).toBe(source.count())
        }
    })

    test("short-circuit queries do not inspect entries after their answer is known", () => {
        const source = collect(range(10_000))

        let firstCalls = 0
        source.first((value) => {
            firstCalls += 1
            return value === 3
        })
        expect(firstCalls).toBe(4)

        let searchCalls = 0
        source.search((value) => {
            searchCalls += 1
            return value === 3
        })
        expect(searchCalls).toBe(4)

        let someCalls = 0
        source.some((value) => {
            someCalls += 1
            return value === 3
        })
        expect(someCalls).toBe(4)

        let everyCalls = 0
        source.every((value) => {
            everyCalls += 1
            return value < 3
        })
        expect(everyCalls).toBe(4)

        let takeUntilCalls = 0
        source.takeUntil((value) => {
            takeUntilCalls += 1
            return value === 3
        })
        expect(takeUntilCalls).toBe(4)

        let takeWhileCalls = 0
        source.takeWhile((value) => {
            takeWhileCalls += 1
            return value < 3
        })
        expect(takeWhileCalls).toBe(4)

        let skipUntilCalls = 0
        source.skipUntil((value) => {
            skipUntilCalls += 1
            return value === 3
        })
        expect(skipUntilCalls).toBe(4)

        let skipWhileCalls = 0
        source.skipWhile((value) => {
            skipWhileCalls += 1
            return value < 3
        })
        expect(skipWhileCalls).toBe(4)
    })

    test("hasAny and hasAll stop consuming a lazy key iterable as soon as possible", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
        ]))
        let anyReads = 0
        let allReads = 0

        function* anyKeys(): Generator<string> {
            anyReads += 1
            yield "a"
            anyReads += 1
            yield "never-consumed"
        }

        function* allKeys(): Generator<string> {
            allReads += 1
            yield "missing"
            allReads += 1
            yield "never-consumed"
        }

        expect(source.hasAny(anyKeys())).toBe(true)
        expect(source.hasAll(allKeys())).toBe(false)
        expect(anyReads).toBe(1)
        expect(allReads).toBe(1)
    })

    test("sortBy and sortByDesc resolve callback selectors exactly once per source entry", () => {
        const source = collect(range(5_000))
        let ascendingCalls = 0
        let descendingCalls = 0

        source.sortBy((value) => {
            ascendingCalls += 1
            return value % 97
        })
        source.sortByDesc((value) => {
            descendingCalls += 1
            return value % 97
        })

        expect(ascendingCalls).toBe(source.count())
        expect(descendingCalls).toBe(source.count())
    })

    test("zero-sized random samples avoid shuffle work entirely", () => {
        const source = collect(range(10_000))
        const originalRandom = Math.random
        let randomCalls = 0

        Math.random = () => {
            randomCalls += 1
            return 0.5
        }

        try {
            expect(source.random(0).empty()).toBe(true)
            expect(randomCalls).toBe(0)
        } finally {
            Math.random = originalRandom
        }
    })


    test("aggregate selectors perform one selector evaluation per source entry", () => {
        const source = collect(range(4_000))

        for (const operation of [
            (counter: { calls: number }) => source.sum((value) => {
                counter.calls += 1
                return value
            }),
            (counter: { calls: number }) => source.average((value) => {
                counter.calls += 1
                return value
            }),
            (counter: { calls: number }) => source.min((value) => {
                counter.calls += 1
                return value
            }),
            (counter: { calls: number }) => source.max((value) => {
                counter.calls += 1
                return value
            }),
            (counter: { calls: number }) => source.median((value) => {
                counter.calls += 1
                return value
            }),
            (counter: { calls: number }) => source.mode((value) => {
                counter.calls += 1
                return value % 10
            }),
        ]) {
            const counter = { calls: 0 }
            operation(counter)
            expect(counter.calls).toBe(source.count())
        }
    })

    test("each, firstOrFail and sole stop once their documented answer is known", () => {
        const source = collect(range(10_000))

        let eachCalls = 0
        source.each((value) => {
            eachCalls += 1
            return value === 3 ? false : undefined
        })
        expect(eachCalls).toBe(4)

        let firstCalls = 0
        source.firstOrFail((value) => {
            firstCalls += 1
            return value === 3
        })
        expect(firstCalls).toBe(4)

        let soleCalls = 0
        expect(() => source.sole((value) => {
            soleCalls += 1
            return value === 2 || value === 4
        })).toThrow()
        expect(soleCalls).toBe(5)
    })

    test("groupBy and countBy scale callback work linearly with source size", () => {
        for (const size of [1, 10, 100, 1_000, 5_000]) {
            const source = collect(range(size))
            let groupCalls = 0
            let countCalls = 0

            source.groupBy((value) => {
                groupCalls += 1
                return value % 16
            })
            source.countBy((value) => {
                countCalls += 1
                return value % 16
            })

            expect(groupCalls).toBe(size)
            expect(countCalls).toBe(size)
        }
    })

    test("chunk, split and values conserve total item count at large sizes", () => {
        const source = collect(range(20_000))
        const chunkedCount = source.chunk(127).sum((chunk) => chunk.count())
        const splitCount = source.split(37).sum((group) => group.count())

        expect(chunkedCount).toBe(source.count())
        expect(splitCount).toBe(source.count())
        expect(source.values().count()).toBe(source.count())
    })

    test("large flatMap output does not depend on function argument spreading", () => {
        const size = 100_000
        const result = collect([0]).flatMap(() => range(size))

        expect(result.count()).toBe(size)
        expect(result.first()).toBe(0)
        expect(result.last()).toBe(size - 1)
    })

    test("flatten handles deeply nested iterables without recursive call-stack growth", () => {
        let nested: unknown = "leaf"

        for (let index = 0; index < 20_000; index += 1) {
            nested = [nested]
        }

        const result = collect([nested]).flatten()

        expect(result.items()).toEqual(["leaf"])
    })

    test("append scans large numeric key sets without Math.max argument spreading", () => {
        const size = 100_000
        const source = collect(new Map(
            range(size).map((key) => [key, key] as const),
        ))
        const result = source.append("tail")

        expect(result.count()).toBe(size + 1)
        expect(result.get(size)).toBe("tail")
    })

    test("pad supports large target sizes without push/unshift argument spreading", () => {
        const size = 100_000
        const right = collect([1]).pad(size, 0)
        const left = collect([1]).pad(-size, 0)

        expect(right.count()).toBe(size)
        expect(right.first()).toBe(1)
        expect(right.last()).toBe(0)
        expect(left.count()).toBe(size)
        expect(left.first()).toBe(0)
        expect(left.last()).toBe(1)
    })
})

describe("high-value feature work bounds", () => {
    test("mapToGroups and percentage evaluate their callbacks exactly once per entry", () => {
        const source = collect(range(4_000))
        let groupCalls = 0
        let percentageCalls = 0

        source.mapToGroups((value) => {
            groupCalls += 1
            return [value % 8, value] as const
        })
        source.percentage((value) => {
            percentageCalls += 1
            return value % 2 === 0
        })

        expect(groupCalls).toBe(source.count())
        expect(percentageCalls).toBe(source.count())
    })

    test("hasMany and hasSole stop after a second predicate match", () => {
        const source = collect(range(10_000))
        let manyCalls = 0
        let soleCalls = 0

        expect(source.hasMany((value) => {
            manyCalls += 1
            return value === 2 || value === 4
        })).toBe(true)
        expect(manyCalls).toBe(5)

        expect(source.hasSole((value) => {
            soleCalls += 1
            return value === 2 || value === 4
        })).toBe(false)
        expect(soleCalls).toBe(5)
    })

    test("chunkWhile evaluates only continuation items and receives bounded current chunks", () => {
        const source = collect(range(5_000))
        let calls = 0
        let maximumChunk = 0

        const chunks = source.chunkWhile((value, _key, chunk) => {
            calls += 1
            maximumChunk = Math.max(maximumChunk, chunk.count())
            return value % 100 !== 0
        })

        expect(calls).toBe(source.count() - 1)
        expect(maximumChunk).toBeLessThanOrEqual(100)
        expect(chunks.count()).toBe(50)
    })

    test("reduceSpread evaluates one reducer call per entry", () => {
        const source = collect(range(3_000))
        let calls = 0

        const [sum, count] = source.reduceSpread((sum, count, value) => {
            calls += 1
            return [sum + value, count + 1]
        }, 0, 0)

        expect(calls).toBe(source.count())
        expect(count).toBe(source.count())
        expect(sum).toBe(source.sum())
    })
})

import { describe, expect, test } from "bun:test"

import { collect } from "../../dist/index.js"

describe("high-value edge-case contracts", () => {
    test("combine consumes iterable values once and rejects too-short or too-long generators", () => {
        const visited: number[] = []
        function* exact() {
            for (const value of [10, 20, 30]) {
                visited.push(value)
                yield value
            }
        }

        expect(collect(["a", "b", "c"]).combine(exact()).entries()).toEqual([
            ["a", 10],
            ["b", 20],
            ["c", 30],
        ])
        expect(visited).toEqual([10, 20, 30])

        expect(() => collect(["a", "b"]).combine((function* () {
            yield 1
        })())).toThrow(RangeError)
        expect(() => collect(["a"]).combine((function* () {
            yield 1
            yield 2
        })())).toThrow(RangeError)
        expect(collect([] as string[]).combine([]).empty()).toBe(true)
    })

    test("concat accepts generators and maps without retaining their keys", () => {
        function* generated() {
            yield 30
            yield 40
        }

        const result = collect(new Map<string | number, number>([
            ["named", 10],
            [5, 20],
        ]))
            .concat(generated())
            .concat(new Map([["ignored", 50]]))

        expect(result.entries()).toEqual([
            ["named", 10],
            [5, 20],
            [6, 30],
            [7, 40],
            [8, 50],
        ])
    })

    test("collapseWithKeys handles empty sources and preserves first insertion position on overwrite", () => {
        const result = collect([
            new Map<string, number>(),
            new Map([["shared", 1], ["a", 2]]),
            new Map([["shared", 3], ["b", 4]]),
        ]).collapseWithKeys()

        expect(result.entries()).toEqual([
            ["shared", 3],
            ["a", 2],
            ["b", 4],
        ])
        expect(collect([] as Array<Map<string, number>>).collapseWithKeys().empty()).toBe(true)
    })

    test("mapSpread and eachSpread do not invoke callbacks for empty collections", () => {
        const source = collect(new Map<string, readonly [number, number]>())
        let mapCalls = 0
        let eachCalls = 0

        expect(source.mapSpread(() => {
            mapCalls += 1
            return 1
        }).empty()).toBe(true)
        expect(source.eachSpread(() => {
            eachCalls += 1
        })).toBe(source)

        expect(mapCalls).toBe(0)
        expect(eachCalls).toBe(0)
    })

    test("mapToGroups preserves first group order and source order inside each group", () => {
        const source = collect(new Map([
            ["a", { group: "x", value: 1 }],
            ["b", { group: "y", value: 2 }],
            ["c", { group: "x", value: 3 }],
            ["d", { group: "y", value: 4 }],
        ]))

        const groups = source.mapToGroups((item, key) => [item.group, `${key}:${item.value}`] as const)

        expect(groups.keys()).toEqual(["x", "y"])
        expect(groups.get("x")?.items()).toEqual(["a:1", "c:3"])
        expect(groups.get("y")?.items()).toEqual(["b:2", "d:4"])
    })

    test("multiply conserves source value references and does no work for zero", () => {
        const object = { id: 1 }
        const source = collect([object])

        expect(source.multiply(0).items()).toEqual([])
        const repeated = source.multiply(3)
        expect(repeated.items()).toEqual([object, object, object])
        expect(repeated.get(0)).toBe(object)
        expect(repeated.get(2)).toBe(object)
    })

    test("select omits missing and inherited properties while supporting symbol keys", () => {
        const token = Symbol("token")
        const prototype = { inherited: "no" }
        const value = Object.assign(Object.create(prototype), {
            name: "Ada",
            [token]: 42,
        }) as { name: string; inherited?: string; [token]: number }
        const source = collect([value])

        expect(source.select(["name", "inherited"] as const).get(0)).toEqual({ name: "Ada" })
        expect(source.select(token).get(0)?.[token]).toBe(42)
    })

    test("dot supports numeric keys but rejects lossy object and symbol keys at every level", () => {
        expect(collect(new Map<number, unknown>([[10, { value: 1 }]])).dot().entries()).toEqual([
            ["10.value", 1],
        ])
        expect(() => collect(new Map<object, unknown>([[{}, 1]])).dot()).toThrow(TypeError)
        expect(() => collect({ nested: new Map<object, number>([[{}, 1]]) }).dot()).toThrow(TypeError)
        expect(() => collect({ nested: new Map([[Symbol("x"), 1]]) }).dot()).toThrow(TypeError)
    })

    test("undot conflict resolution follows source order and is safe for prototype-like path segments", () => {
        const scalarThenNested = collect(new Map<string, unknown>([
            ["user", "scalar"],
            ["user.name", "Ada"],
        ])).undot()
        const nestedThenScalar = collect(new Map<string, unknown>([
            ["user.name", "Ada"],
            ["user", "scalar"],
        ])).undot()
        const protectedPath = collect(new Map<string, unknown>([
            ["safe.__proto__.polluted", true],
        ])).undot()

        expect((scalarThenNested.get("user") as any).name).toBe("Ada")
        expect(nestedThenScalar.get("user")).toBe("scalar")
        expect((protectedPath.get("safe") as any).__proto__.polluted).toBe(true)
        expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
    })

    test("diffAssoc and intersectAssoc distinguish missing keys from stored undefined", () => {
        const source = collect(new Map<string, number | undefined>([
            ["present", undefined],
            ["value", 1],
        ]))

        expect(source.intersectAssoc(new Map<string, number | undefined>([
            ["present", undefined],
        ])).keys()).toEqual(["present"])
        expect(source.diffAssoc(new Map<string, number | undefined>()).keys()).toEqual(["present", "value"])
    })

    test("sortKeysUsing is stable when the comparator reports equality", () => {
        const source = collect(new Map([
            ["a1", 1],
            ["a2", 2],
            ["b1", 3],
            ["b2", 4],
        ]))

        const sorted = source.sortKeysUsing((left, right) => left[0]!.localeCompare(right[0]!))
        expect(sorted.keys()).toEqual(["a1", "a2", "b1", "b2"])
    })

    test("whereBetween is inclusive and reversed ranges match nothing", () => {
        const source = collect([{ score: 10 }, { score: 20 }, { score: 30 }])

        expect(source.whereBetween("score", [10, 30]).count()).toBe(3)
        expect(source.whereBetween("score", [20, 20]).pluck("score").items()).toEqual([20])
        expect(source.whereBetween("score", [30, 10]).empty()).toBe(true)
        expect(source.whereNotBetween("score", [30, 10]).count()).toBe(3)
    })

    test("whereInstanceOf handles empty class lists and keeps only actual instances", () => {
        class A {}
        class B {}
        const a = new A()
        const b = new B()
        const source = collect<A | B | object>([a, b, {}])

        expect(source.whereInstanceOf([]).empty()).toBe(true)
        expect(source.whereInstanceOf([A, B]).items()).toEqual([a, b])
    })

    test("percentage never invokes its predicate for empty collections", () => {
        let calls = 0
        const result = collect([] as number[]).percentage(() => {
            calls += 1
            return true
        })

        expect(result).toBeUndefined()
        expect(calls).toBe(0)
    })

    test("reduceSpread accepts readonly tuple state and isolates the next carry array", () => {
        const retained: Array<readonly [number, number]> = []
        const result = collect([2, 3]).reduceSpread(
            (sum, count, value) => {
                const next = [sum + value, count + 1] as const
                retained.push(next)
                return next
            },
            0 as number,
            0 as number,
        )

        expect(result).toEqual([5, 2])
        expect(result).not.toBe(retained[1])
    })

    test("pipeThrough supports arbitrary callback counts at runtime", () => {
        const source = collect([1, 2])
        const calls: number[] = []
        const callbacks = [
            (value: any) => {
                calls.push(1)
                return value.sum()
            },
            (value: any) => {
                calls.push(2)
                return value + 1
            },
            (value: any) => {
                calls.push(3)
                return value * 2
            },
            (value: any) => {
                calls.push(4)
                return value - 1
            },
            (value: any) => {
                calls.push(5)
                return value * 3
            },
            (value: any) => {
                calls.push(6)
                return value + 4
            },
        ] as const

        expect(source.pipeThrough(callbacks)).toBe(25)
        expect(calls).toEqual([1, 2, 3, 4, 5, 6])
    })

    test("empty conditional helpers preserve identity when neither selected callback changes the collection", () => {
        const empty = collect<number>([])
        const full = collect<number>([1])

        expect(empty.whenNotEmpty((collection) => collection)).toBe(empty)
        expect(empty.unlessEmpty((collection) => collection)).toBe(empty)
        expect(full.whenEmpty((collection) => collection)).toBe(full)
        expect(full.unlessNotEmpty((collection) => collection)).toBe(full)
    })

    test("before and after do not continue scanning after the required adjacent value is known", () => {
        const source = collect([10, 20, 30, 40])
        let beforeCalls = 0
        let afterCalls = 0

        expect(source.before((value) => {
            beforeCalls += 1
            return value === 30
        })).toBe(20)
        expect(source.after((value) => {
            afterCalls += 1
            return value === 20
        })).toBe(30)

        expect(beforeCalls).toBe(3)
        expect(afterCalls).toBe(2)
    })

    test("forPage and splitIn preserve original entry keys inside every returned group", () => {
        const source = collect(new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
            ["d", 4],
        ]))

        expect(source.forPage(2, 2).entries()).toEqual([["c", 3], ["d", 4]])
        expect(source.splitIn(3).items().map((group) => group.keys())).toEqual([
            ["a", "b"],
            ["c", "d"],
        ])
    })
})

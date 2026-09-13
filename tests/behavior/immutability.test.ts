import { describe, expect, test } from "bun:test"

import { collect } from "../../dist/index.js"

describe("immutability invariants", () => {
    test("construction snapshots Maps and arrays", () => {
        const map = new Map([["a", 1]])
        const array = [1, 2]
        const fromMap = collect(map)
        const fromArray = collect(array)

        map.set("b", 2)
        array.push(3)

        expect(fromMap.entries()).toEqual([["a", 1]])
        expect(fromArray.items()).toEqual([1, 2])
    })

    test("exported arrays, maps and objects cannot mutate collection membership", () => {
        const source = collect(new Map([["a", 1], ["b", 2]]))
        const array = source.toArray()
        const map = source.toMap() as Map<string, number>
        const object = source.toObject()

        array.push(3)
        map.set("c", 3)
        object.a = 99

        expect(source.entries()).toEqual([["a", 1], ["b", 2]])
    })

    test("fluent operations leave their source untouched", () => {
        const source = collect(new Map([["a", 3], ["b", 1], ["c", 2]]))

        source
            .filter((value) => value > 1)
            .map((value) => value * 10)
            .sort((left, right) => left - right)
            .remove("c")

        expect(source.entries()).toEqual([["a", 3], ["b", 1], ["c", 2]])
    })
})

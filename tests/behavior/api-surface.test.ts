import { describe, expect, test } from "bun:test"

import { Collection } from "../../dist/index.js"

const expectedMethods = [
    "all", "append", "average", "avg", "chunk", "collapse", "contains", "count", "countBy",
    "crossJoin", "diff", "diffKeys", "doesntContain", "duplicates", "each", "empty", "entries",
    "every", "except", "filter", "first", "firstOrFail", "flatMap", "flatten", "get", "getOr",
    "groupBy", "has", "hasAll", "hasAny", "implode", "intersect", "intersectByKeys", "items", "join",
    "keyBy", "keys", "last", "lastOrFail", "map", "mapKeys", "mapValues", "mapWithKeys", "max",
    "median", "merge", "min", "mode", "notEmpty", "nth", "only", "pad", "partition", "pipe",
    "pluck", "prepend", "random", "reduce", "reject", "remove", "replace", "reverse", "search",
    "shuffle", "skip", "skipUntil", "skipWhile", "slice", "sliding", "sole", "some", "sort",
    "sortBy", "sortByDesc", "sortKeys", "sortKeysDesc", "split", "sum", "take", "takeUntil",
    "takeWhile", "tap", "toArray", "toMap", "toObject", "union", "unique", "unless", "values",
    "when", "where", "whereIn", "whereNot", "whereNotIn", "whereNotNull", "whereNull", "with", "zip",
].sort()

describe("public API contract", () => {
    test("Collection exposes the complete documented method inventory", () => {
        const methods = Reflect.ownKeys(Collection.prototype)
            .filter((key): key is string => typeof key === "string" && key !== "constructor")
            .sort()

        expect(methods).toEqual(expectedMethods)
        expect(typeof Collection.prototype[Symbol.iterator]).toBe("function")
    })
})

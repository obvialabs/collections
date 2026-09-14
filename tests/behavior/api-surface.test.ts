import { describe, expect, test } from "bun:test"

import { Collection } from "#collections"

const expectedMethods = [
    "after", "all", "append", "average", "avg", "before", "chunk", "chunkWhile", "collapse",
    "collapseWithKeys", "combine", "concat", "contains", "count", "countBy", "crossJoin", "diff", "diffAssoc",
    "diffKeys", "doesntContain", "dot", "duplicates", "each", "eachSpread", "empty", "entries", "every",
    "except", "filter", "first", "firstOrFail", "firstWhere", "flatMap", "flatten", "flip", "forPage",
    "get", "getOr", "groupBy", "has", "hasAll", "hasAny", "hasMany", "hasSole", "implode",
    "intersect", "intersectAssoc", "intersectByKeys", "items", "join", "keyBy", "keys", "last", "lastOrFail",
    "map", "mapInto", "mapKeys", "mapSpread", "mapToGroups", "mapValues", "mapWithKeys", "max", "median",
    "merge", "min", "mode", "multiply", "notEmpty", "nth", "only", "pad", "partition",
    "percentage", "pipe", "pipeInto", "pipeThrough", "pluck", "prepend", "random", "reduce", "reduceSpread",
    "reject", "remove", "replace", "reverse", "search", "select", "shuffle", "skip", "skipUntil",
    "skipWhile", "slice", "sliding", "sole", "some", "sort", "sortBy", "sortByDesc", "sortDesc",
    "sortKeys", "sortKeysDesc", "sortKeysUsing", "split", "splitIn", "sum", "take", "takeUntil", "takeWhile",
    "tap", "toArray", "toMap", "toObject", "undot", "union", "unique", "unless", "unlessEmpty",
    "unlessNotEmpty", "values", "when", "whenEmpty", "whenNotEmpty", "where", "whereBetween", "whereIn", "whereInstanceOf",
    "whereNot", "whereNotBetween", "whereNotIn", "whereNotNull", "whereNull", "with", "zip",
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

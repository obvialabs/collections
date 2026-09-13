import { describe, expect, test } from "bun:test"

const publicMethods = [
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
] as const

async function readReadme(): Promise<string> {
    return Bun.file(new URL("../../README.md", import.meta.url)).text()
}

function sectionFor(readme: string, heading: string): string {
    const marker = `### \`${heading}\``
    const start = readme.indexOf(marker)

    if (start === -1) return ""

    const nextHeading = readme.indexOf("\n### `", start + marker.length)
    const nextSection = readme.indexOf("\n## ", start + marker.length)
    const candidates = [nextHeading, nextSection].filter((index) => index !== -1)
    const end = candidates.length === 0 ? readme.length : Math.min(...candidates)

    return readme.slice(start, end)
}

describe("README contract", () => {
    test("explains when to use collect() and createCollection()", async () => {
        const readme = await readReadme()

        expect(readme).toContain("## `collect()` vs `createCollection()`")
        expect(readme).toContain("Choose `collect()` for runtime values")
        expect(readme).toContain("Choose `createCollection()` for definitions")
        expect(readme).toContain("Direct access exists only on the definition root")
        expect(readme).toContain("Method-name collisions stay safe")
        expect(readme).toContain("runtime data versus source-defined keyed definitions")
        expect(readme).toContain("Item `id` injection")
        expect(readme).toContain("Direct `collection.someKey` access")
    })

    test("documents every public Collection method with TypeScript usage", async () => {
        const readme = await readReadme()

        for (const method of publicMethods) {
            const section = sectionFor(readme, method)

            expect(section.length).toBeGreaterThan(0)
            expect(section).toContain("**Behavior:**")
            expect(section.split("```ts").length - 1).toBeGreaterThanOrEqual(2)
        }

        const iterator = sectionFor(readme, "[Symbol.iterator]")
        expect(iterator.length).toBeGreaterThan(0)
        expect(iterator).toContain("**Behavior:**")
        expect(iterator.split("```ts").length - 1).toBeGreaterThanOrEqual(2)
    })

    test("documents behavior guarantees, mistakes, tests and benchmarks", async () => {
        const readme = await readReadme()

        for (const heading of [
            "## Behavioral Guarantees",
            "## Method Behavior Matrix",
            "## Usage Cookbook",
            "## Common Mistakes",
            "### Test strategy",
            "### Benchmarks",
        ]) {
            expect(readme).toContain(heading)
        }
    })

})

import { describe, expect, test } from "bun:test"

const publicMethods = [
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
] as const

async function readText(path: string): Promise<string> {
    return Bun.file(new URL(path, import.meta.url)).text()
}

function sectionFor(document: string, heading: string): string {
    const marker = `### \`${heading}\``
    const start = document.indexOf(marker)

    if (start === -1) return ""

    const nextHeading = document.indexOf("\n### `", start + marker.length)
    const nextSection = document.indexOf("\n## ", start + marker.length)
    const candidates = [nextHeading, nextSection].filter((index) => index !== -1)
    const end = candidates.length === 0 ? document.length : Math.min(...candidates)

    return document.slice(start, end)
}

describe("documentation contract", () => {
    test("keeps the README concise and explains the two collection factories", async () => {
        const readme = await readText("../../README.md")
        const lineCount = readme.split("\n").length

        expect(lineCount).toBeLessThan(800)
        expect(readme).toContain("## `collect()` vs `createCollection()`")
        expect(readme).toContain("### Choose `collect()` for runtime data")
        expect(readme).toContain("### Choose `createCollection()` for definitions")
        expect(readme).toContain("### Direct access exists only on the definition root")
        expect(readme).toContain("### Method-name collisions stay safe")
        expect(readme).toContain("docs/api.md")
        expect(readme).toContain("## Common workflows")
        expect(readme).toContain("## API at a glance")
        expect(readme).toContain("## Testing and quality")
    })

    test("documents every public Collection method in the dedicated API reference", async () => {
        const api = await readText("../../docs/api.md")

        for (const method of publicMethods) {
            const section = sectionFor(api, method)

            expect(section.length).toBeGreaterThan(0)
            expect(section).toContain("**Behavior:**")
            expect(section.split("```ts").length - 1).toBeGreaterThanOrEqual(2)
        }

        const iterator = sectionFor(api, "[Symbol.iterator]")
        expect(iterator.length).toBeGreaterThan(0)
        expect(iterator).toContain("**Behavior:**")
        expect(iterator.split("```ts").length - 1).toBeGreaterThanOrEqual(2)
    })

    test("keeps complete reference documentation outside the package overview", async () => {
        const readme = await readText("../../README.md")
        const api = await readText("../../docs/api.md")

        expect(api.split("\n").length).toBeGreaterThan(readme.split("\n").length)
        expect(api).toContain("# API Reference")
        expect(api).toContain("## Creating Collections")
        expect(api).toContain("## Collection")
        expect(api).toContain("## Errors")
    })
})

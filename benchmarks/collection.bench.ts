import { collect, createCollection } from "../dist/index.js"

type BenchmarkResult = {
    name: string
    size: number
    medianMs: number
    p95Ms: number
    operationsPerSecond: number
    itemsPerSecond: number
}

type BenchmarkCase = {
    name: string
    size: number
    run: () => void
}

const environment = (globalThis as {
    Bun?: { env?: Record<string, string | undefined> }
}).Bun?.env

const PRIMARY_SIZE = readPositiveInteger(environment?.COLLECTION_BENCH_SIZE, 25_000)
const SAMPLES = readPositiveInteger(environment?.COLLECTION_BENCH_SAMPLES, 15)
const WARMUPS = readPositiveInteger(environment?.COLLECTION_BENCH_WARMUPS, 3)
const LOOKUP_ITERATIONS = readPositiveInteger(environment?.COLLECTION_BENCH_LOOKUPS, 250_000)

const sizes = uniquePositiveIntegers([
    Math.max(100, Math.floor(PRIMARY_SIZE / 10)),
    PRIMARY_SIZE,
    PRIMARY_SIZE * 4,
])

let sink = 0
const cases: BenchmarkCase[] = []

for (const size of sizes) {
    const numbers = Array.from({ length: size }, (_, index) => index)
    const records = Array.from({ length: size }, (_, index) => ({
        id: index,
        group: `group-${index % 50}`,
        score: (index * 17) % 10_000,
        enabled: index % 3 !== 0,
    }))
    const numberCollection = collect(numbers)
    const recordCollection = collect(records)

    cases.push(
        {
            name: "construct / collect(array)",
            size,
            run: () => {
                sink += collect(numbers).count()
            },
        },
        {
            name: "iterate / items()",
            size,
            run: () => {
                sink += numberCollection.items().length
            },
        },
        {
            name: "transform / native map+filter",
            size,
            run: () => {
                sink += numbers
                    .map((value) => value * 2)
                    .filter((value) => value % 3 === 0)
                    .length
            },
        },
        {
            name: "transform / Collection map+filter",
            size,
            run: () => {
                sink += numberCollection
                    .map((value) => value * 2)
                    .filter((value) => value % 3 === 0)
                    .count()
            },
        },
        {
            name: "query / filter+take",
            size,
            run: () => {
                sink += recordCollection
                    .filter((record) => record.enabled)
                    .take(500)
                    .count()
            },
        },
        {
            name: "group / groupBy",
            size,
            run: () => {
                sink += recordCollection.groupBy("group").count()
            },
        },
        {
            name: "group / countBy",
            size,
            run: () => {
                sink += recordCollection.countBy("group").count()
            },
        },
        {
            name: "set / unique(selector)",
            size,
            run: () => {
                sink += recordCollection.unique((record) => record.group).count()
            },
        },
        {
            name: "window / chunk(128)",
            size,
            run: () => {
                sink += recordCollection.chunk(128).count()
            },
        },
        {
            name: "ordering / sortBy(score)",
            size,
            run: () => {
                sink += recordCollection.sortBy("score").count()
            },
        },
        {
            name: "pipeline / filter+sortByDesc+take+pluck+sum",
            size,
            run: () => {
                sink += recordCollection
                    .filter((record) => record.enabled)
                    .sortByDesc("score")
                    .take(500)
                    .pluck("id")
                    .sum()
            },
        },
    )
}

const defined = createCollection({
    canvas: { title: "Canvas" },
    automation: { title: "Automation" },
    security: { title: "Security" },
})

cases.push(
    {
        name: "defined / direct property lookup",
        size: LOOKUP_ITERATIONS,
        run: () => {
            for (let index = 0; index < LOOKUP_ITERATIONS; index += 1) {
                sink += defined.security.title.length
            }
        },
    },
    {
        name: "defined / get(key) lookup",
        size: LOOKUP_ITERATIONS,
        run: () => {
            for (let index = 0; index < LOOKUP_ITERATIONS; index += 1) {
                sink += defined.get("security")!.title.length
            }
        },
    },
)

const results = cases.map((benchmarkCase) => benchmark(benchmarkCase))

console.log("@obvia/collections benchmark")
console.log(
    `sizes=${sizes.map((size) => size.toLocaleString()).join(", ")} `
    + `samples=${SAMPLES} warmups=${WARMUPS} lookups=${LOOKUP_ITERATIONS.toLocaleString()}`,
)
console.log("Benchmarks are observational and intentionally have no timing pass/fail threshold.")
console.table(results.map((result) => ({
    benchmark: result.name,
    items: result.size.toLocaleString(),
    "median ms": result.medianMs.toFixed(3),
    "p95 ms": result.p95Ms.toFixed(3),
    "ops/sec": formatNumber(result.operationsPerSecond),
    "items/sec": formatNumber(result.itemsPerSecond),
})))

// Keep benchmark work observable to the runtime without making the sink useful.
if (sink === Number.MIN_SAFE_INTEGER) {
    console.log(sink)
}

function benchmark(benchmarkCase: BenchmarkCase): BenchmarkResult {
    for (let index = 0; index < WARMUPS; index += 1) {
        benchmarkCase.run()
    }

    const samples: number[] = []

    for (let index = 0; index < SAMPLES; index += 1) {
        const startedAt = performance.now()
        benchmarkCase.run()
        samples.push(performance.now() - startedAt)
    }

    samples.sort((left, right) => left - right)

    const medianMs = percentile(samples, 0.5)
    const p95Ms = percentile(samples, 0.95)
    const operationsPerSecond = medianMs === 0
        ? Number.POSITIVE_INFINITY
        : 1_000 / medianMs

    return {
        name: benchmarkCase.name,
        size: benchmarkCase.size,
        medianMs,
        p95Ms,
        operationsPerSecond,
        itemsPerSecond: operationsPerSecond * benchmarkCase.size,
    }
}

function percentile(values: readonly number[], ratio: number): number {
    const index = Math.min(
        values.length - 1,
        Math.max(0, Math.ceil(values.length * ratio) - 1),
    )

    return values[index] ?? 0
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
    if (value === undefined) return fallback

    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function uniquePositiveIntegers(values: readonly number[]): number[] {
    return [...new Set(values.filter((value) => Number.isInteger(value) && value > 0))]
        .sort((left, right) => left - right)
}

function formatNumber(value: number): string {
    return Number.isFinite(value)
        ? Math.round(value).toLocaleString()
        : "∞"
}

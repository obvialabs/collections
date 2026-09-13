import { collect, createCollection } from "../dist/index.js"

type BenchmarkResult = {
    name: string
    medianMs: number
    p95Ms: number
    opsPerSecond: number
}

const environment = (globalThis as {
    Bun?: { env?: Record<string, string | undefined> }
}).Bun?.env

const DATASET_SIZE = readPositiveInteger(environment?.COLLECTION_BENCH_SIZE, 25_000)
const SAMPLES = readPositiveInteger(environment?.COLLECTION_BENCH_SAMPLES, 15)
const WARMUPS = readPositiveInteger(environment?.COLLECTION_BENCH_WARMUPS, 3)

const numbers = Array.from({ length: DATASET_SIZE }, (_, index) => index)
const records = Array.from({ length: DATASET_SIZE }, (_, index) => ({
    id: index,
    group: `group-${index % 50}`,
    score: (index * 17) % 10_000,
    enabled: index % 3 !== 0,
}))

const numberCollection = collect(numbers)
const recordCollection = collect(records)
const defined = createCollection({
    canvas: { title: "Canvas" },
    automation: { title: "Automation" },
    security: { title: "Security" },
})

let sink = 0

const results = [
    benchmark("native Array map/filter", () => {
        const result = numbers.map((value) => value * 2).filter((value) => value % 3 === 0)
        sink += result.length
    }),
    benchmark("collect array", () => {
        sink += collect(numbers).count()
    }),
    benchmark("Collection map/filter", () => {
        sink += numberCollection
            .map((value) => value * 2)
            .filter((value) => value % 3 === 0)
            .count()
    }),
    benchmark("Collection groupBy", () => {
        sink += recordCollection.groupBy("group").count()
    }),
    benchmark("Collection sortBy", () => {
        sink += recordCollection.sortBy("score").count()
    }),
    benchmark("Collection fluent pipeline", () => {
        sink += recordCollection
            .filter((record) => record.enabled)
            .sortByDesc("score")
            .take(500)
            .pluck("id")
            .sum()
    }),
    benchmark("defined collection direct access", () => {
        for (let index = 0; index < 100_000; index += 1) {
            sink += defined.security.title.length
        }
    }),
]

console.log(`@obvia/collections benchmark`)
console.log(`dataset=${DATASET_SIZE.toLocaleString()} samples=${SAMPLES} warmups=${WARMUPS}`)
console.table(results.map((result) => ({
    benchmark: result.name,
    "median ms": result.medianMs.toFixed(3),
    "p95 ms": result.p95Ms.toFixed(3),
    "ops/sec": Math.round(result.opsPerSecond).toLocaleString(),
})))

// Keep benchmark work observable to the runtime without making the value useful.
if (sink === Number.MIN_SAFE_INTEGER) {
    console.log(sink)
}

function benchmark(name: string, callback: () => void): BenchmarkResult {
    for (let index = 0; index < WARMUPS; index += 1) {
        callback()
    }

    const samples: number[] = []

    for (let index = 0; index < SAMPLES; index += 1) {
        const startedAt = performance.now()
        callback()
        samples.push(performance.now() - startedAt)
    }

    samples.sort((left, right) => left - right)

    const medianMs = percentile(samples, 0.5)
    const p95Ms = percentile(samples, 0.95)

    return {
        name,
        medianMs,
        p95Ms,
        opsPerSecond: medianMs === 0 ? Number.POSITIVE_INFINITY : 1_000 / medianMs,
    }
}

function percentile(values: readonly number[], ratio: number): number {
    const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * ratio) - 1))
    return values[index] ?? 0
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
    if (value === undefined) return fallback

    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

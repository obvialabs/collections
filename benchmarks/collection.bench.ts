import { collect } from "../dist/index.js"

type BenchmarkProfileName = "quick" | "ci" | "thorough"

type BenchmarkProfile = {
    readonly name: BenchmarkProfileName
    readonly sizes: readonly number[]
    readonly samples: number
    readonly warmups: number
    readonly targetLinearItems: number
    readonly targetSortItems: number
}

type BenchmarkCase = {
    readonly id: string
    readonly category: string
    readonly name: string
    readonly size: number
    readonly run: () => number
    readonly baselineId?: string
    readonly headline?: boolean
    readonly targetItems?: number
}

type BenchmarkResult = {
    readonly id: string
    readonly category: string
    readonly name: string
    readonly size: number
    readonly repetitions: number
    readonly samples: number
    readonly medianMs: number
    readonly p95Ms: number
    readonly minMs: number
    readonly maxMs: number
    readonly operationsPerSecond: number
    readonly itemsPerSecond: number
    readonly baselineId?: string
    readonly relativeToBaseline?: number
    readonly headline: boolean
}

type BenchmarkReport = {
    readonly package: "@obvia/collections"
    readonly profile: BenchmarkProfileName
    readonly generatedAt: string
    readonly runtime: {
        readonly name: "bun"
        readonly version: string
        readonly revision: string
    }
    readonly methodology: {
        readonly warmups: number
        readonly samples: number
        readonly timer: "Bun.nanoseconds"
        readonly gcBetweenSamples: true
        readonly datasetConstructionOutsideTimedRegion: true
    }
    readonly results: readonly BenchmarkResult[]
}

type BunRuntime = {
    readonly argv: readonly string[]
    readonly env: Record<string, string | undefined>
    readonly version: string
    readonly revision: string
    nanoseconds(): number
    gc(force?: boolean): void
    write(path: string, data: string): Promise<number>
}

type BenchmarkRecord = {
    readonly id: number
    readonly group: string
    readonly score: number
    readonly enabled: boolean
    readonly region: string
}

const maybeBun = (globalThis as unknown as { Bun?: BunRuntime }).Bun

if (!maybeBun) {
    throw new Error("The collection benchmark must run with Bun.")
}

const bun: BunRuntime = maybeBun

const profiles: Record<BenchmarkProfileName, BenchmarkProfile> = {
    quick: {
        name: "quick",
        sizes: [10_000, 100_000],
        samples: 5,
        warmups: 2,
        targetLinearItems: 500_000,
        targetSortItems: 100_000,
    },
    ci: {
        name: "ci",
        sizes: [10_000, 100_000, 1_000_000],
        samples: 7,
        warmups: 3,
        targetLinearItems: 1_000_000,
        targetSortItems: 250_000,
    },
    thorough: {
        name: "thorough",
        sizes: [10_000, 100_000, 1_000_000],
        samples: 11,
        warmups: 4,
        targetLinearItems: 2_000_000,
        targetSortItems: 500_000,
    },
}

const profile = resolveProfile()
const results: BenchmarkResult[] = []
let sink = 0

console.log("@obvia/collections benchmark")
console.log(
    `profile=${profile.name} sizes=${profile.sizes.map(formatInteger).join(", ")} `
    + `samples=${profile.samples} warmups=${profile.warmups}`,
)
console.log("Timer: Bun.nanoseconds(); GC runs before every measured sample.")
console.log("Dataset construction is outside the timed region except explicit construction cases.")
console.log("Results are measurements from this machine; no duration is estimated or hard-coded.\n")

for (const size of profile.sizes) {
    runNumberBenchmarks(size)
    bun.gc(true)
    runRecordBenchmarks(size)
    bun.gc(true)
}

runLookupBenchmarks(1_000_000)
applyBaselines(results)

const report: BenchmarkReport = {
    package: "@obvia/collections",
    profile: profile.name,
    generatedAt: new Date().toISOString(),
    runtime: {
        name: "bun",
        version: bun.version,
        revision: bun.revision,
    },
    methodology: {
        warmups: profile.warmups,
        samples: profile.samples,
        timer: "Bun.nanoseconds",
        gcBetweenSamples: true,
        datasetConstructionOutsideTimedRegion: true,
    },
    results,
}

printResults(results)

const markdown = renderMarkdown(report)
await Promise.all([
    bun.write("benchmark-results.json", `${JSON.stringify(report, null, 2)}\n`),
    bun.write("benchmark-results.md", markdown),
])

if (sink === Number.MIN_SAFE_INTEGER) {
    console.log(sink)
}

function runNumberBenchmarks(size: number): void {
    const numbers = Array.from({ length: size }, (_, index) => index + 1)
    const numberCollection = collect(numbers)
    const nativeMap = new Map(numbers.map((value, index) => [index, value] as const))
    const lastValue = numbers.at(-1)!

    runCases([
        {
            id: `numbers.construct.native.${size}`,
            category: "construction",
            name: "native Map construction",
            size,
            run: () => {
                const map = new Map<number, number>()
                for (let index = 0; index < numbers.length; index += 1) {
                    map.set(index, numbers[index]!)
                }
                return map.size
            },
        },
        {
            id: `numbers.construct.collection.${size}`,
            category: "construction",
            name: "collect(array)",
            size,
            baselineId: `numbers.construct.native.${size}`,
            headline: size === 1_000_000,
            run: () => collect(numbers).count(),
        },
        {
            id: `numbers.sum.native.${size}`,
            category: "aggregate",
            name: "native numeric sum",
            size,
            run: () => {
                let total = 0
                for (const value of numbers) total += value
                return total
            },
        },
        {
            id: `numbers.sum.collection.${size}`,
            category: "aggregate",
            name: "Collection.sum()",
            size,
            baselineId: `numbers.sum.native.${size}`,
            headline: size === 1_000_000,
            run: () => numberCollection.sum(),
        },
        {
            id: `numbers.contains.native.${size}`,
            category: "query",
            name: "native includes(last)",
            size,
            run: () => Number(numbers.includes(lastValue)),
        },
        {
            id: `numbers.contains.collection.${size}`,
            category: "query",
            name: "Collection.contains(last)",
            size,
            baselineId: `numbers.contains.native.${size}`,
            headline: size === 1_000_000,
            run: () => Number(numberCollection.contains(lastValue)),
        },
        {
            id: `numbers.filter.native.${size}`,
            category: "transform",
            name: "native filter(even)",
            size,
            run: () => numbers.filter((value) => value % 2 === 0).length,
        },
        {
            id: `numbers.filter.collection.${size}`,
            category: "transform",
            name: "Collection.filter(even)",
            size,
            baselineId: `numbers.filter.native.${size}`,
            headline: size === 1_000_000,
            run: () => numberCollection.filter((value) => value % 2 === 0).count(),
        },
        {
            id: `numbers.map.native.${size}`,
            category: "transform",
            name: "native map(x2)",
            size,
            run: () => numbers.map((value) => value * 2).length,
        },
        {
            id: `numbers.map.collection.${size}`,
            category: "transform",
            name: "Collection.map(x2)",
            size,
            baselineId: `numbers.map.native.${size}`,
            headline: size === 1_000_000,
            run: () => numberCollection.map((value) => value * 2).count(),
        },
        {
            id: `numbers.array.native.${size}`,
            category: "conversion",
            name: "native Array.from(Map.values())",
            size,
            run: () => Array.from(nativeMap.values()).length,
        },
        {
            id: `numbers.array.collection.${size}`,
            category: "conversion",
            name: "Collection.toArray()",
            size,
            baselineId: `numbers.array.native.${size}`,
            headline: size === 1_000_000,
            run: () => numberCollection.toArray().length,
        },
    ])
}

function runRecordBenchmarks(size: number): void {
    const groupNames = Array.from({ length: 100 }, (_, index) => `group-${index}`)
    const regionNames = ["eu", "na", "apac", "latam", "mea", "uk", "in", "au"] as const
    const records: BenchmarkRecord[] = Array.from({ length: size }, (_, index) => ({
        id: index + 1,
        group: groupNames[index % groupNames.length]!,
        score: (index * 48_271) % 100_000,
        enabled: index % 3 !== 0,
        region: regionNames[index % regionNames.length]!,
    }))
    const recordCollection = collect(records)

    const cases: BenchmarkCase[] = [
        {
            id: `records.percentage.native.${size}`,
            category: "aggregate",
            name: "native percentage(enabled)",
            size,
            run: () => {
                let matched = 0
                for (const record of records) {
                    if (record.enabled) matched += 1
                }
                return matched / records.length * 100
            },
        },
        {
            id: `records.percentage.collection.${size}`,
            category: "aggregate",
            name: "Collection.percentage(enabled)",
            size,
            baselineId: `records.percentage.native.${size}`,
            headline: size === 1_000_000,
            run: () => recordCollection.percentage((record) => record.enabled) ?? 0,
        },
        {
            id: `records.countby.native.${size}`,
            category: "grouping",
            name: "native countBy(group)",
            size,
            run: () => {
                const counts = new Map<string, number>()
                for (const record of records) {
                    counts.set(record.group, (counts.get(record.group) ?? 0) + 1)
                }
                return counts.size
            },
        },
        {
            id: `records.countby.collection.${size}`,
            category: "grouping",
            name: "Collection.countBy(group)",
            size,
            baselineId: `records.countby.native.${size}`,
            headline: size === 1_000_000,
            run: () => recordCollection.countBy("group").count(),
        },
        {
            id: `records.select.native.${size}`,
            category: "projection",
            name: "native project(id, score)",
            size,
            run: () => records.map((record) => ({ id: record.id, score: record.score })).length,
        },
        {
            id: `records.select.collection.${size}`,
            category: "projection",
            name: "Collection.select(id, score)",
            size,
            baselineId: `records.select.native.${size}`,
            headline: size === 1_000_000,
            run: () => recordCollection.select(["id", "score"] as const).count(),
        },
        {
            id: `records.pipeline.native.${size}`,
            category: "pipeline",
            name: "native filter + take + score sum",
            size,
            run: () => records
                .filter((record) => record.enabled)
                .slice(0, 1_000)
                .reduce((total, record) => total + record.score, 0),
        },
        {
            id: `records.pipeline.collection.${size}`,
            category: "pipeline",
            name: "Collection filter + take + pluck + sum",
            size,
            baselineId: `records.pipeline.native.${size}`,
            headline: size === 1_000_000,
            run: () => recordCollection
                .filter((record) => record.enabled)
                .take(1_000)
                .pluck("score")
                .sum(),
        },
    ]

    if (size <= 250_000) {
        cases.push(
            {
                id: `records.groupby.native.${size}`,
                category: "grouping",
                name: "native groupBy(group)",
                size,
                run: () => {
                    const groups = new Map<string, BenchmarkRecord[]>()
                    for (const record of records) {
                        const group = groups.get(record.group)
                        if (group) group.push(record)
                        else groups.set(record.group, [record])
                    }
                    return groups.size
                },
            },
            {
                id: `records.groupby.collection.${size}`,
                category: "grouping",
                name: "Collection.groupBy(group)",
                size,
                baselineId: `records.groupby.native.${size}`,
                run: () => recordCollection.groupBy("group").count(),
            },
            {
                id: `records.sort.native.${size}`,
                category: "ordering",
                name: "native sort(score)",
                size,
                targetItems: profile.targetSortItems,
                run: () => records.toSorted((left, right) => left.score - right.score).length,
            },
            {
                id: `records.sort.collection.${size}`,
                category: "ordering",
                name: "Collection.sortBy(score)",
                size,
                targetItems: profile.targetSortItems,
                baselineId: `records.sort.native.${size}`,
                run: () => recordCollection.sortBy("score").count(),
            },
            {
                id: `records.mapgroups.collection.${size}`,
                category: "grouping",
                name: "Collection.mapToGroups(group -> id)",
                size,
                run: () => recordCollection
                    .mapToGroups((record) => [record.group, record.id] as const)
                    .count(),
            },
        )
    }

    runCases(cases)
}

function runLookupBenchmarks(iterations: number): void {
    const source = {
        canvas: { title: "Canvas" },
        automation: { title: "Automation" },
        security: { title: "Security" },
    } as const
    const collection = collect(source)
    const object = collection.toObject()

    runCases([
        {
            id: "lookup.object.property",
            category: "lookup",
            name: "plain object property lookup",
            size: iterations,
            targetItems: iterations,
            run: () => {
                let total = 0
                for (let index = 0; index < iterations; index += 1) {
                    total += object.security.title.length
                }
                return total
            },
        },
        {
            id: "lookup.collection.get",
            category: "lookup",
            name: "Collection.get(key) lookup",
            size: iterations,
            targetItems: iterations,
            baselineId: "lookup.object.property",
            run: () => {
                let total = 0
                for (let index = 0; index < iterations; index += 1) {
                    total += collection.get("security")!.title.length
                }
                return total
            },
        },
    ])
}

function runCases(cases: readonly BenchmarkCase[]): void {
    for (const benchmarkCase of cases) {
        const result = measure(benchmarkCase)
        results.push(result)
        console.log(formatResultLine(result))
    }
}

function measure(benchmarkCase: BenchmarkCase): BenchmarkResult {
    const targetItems = benchmarkCase.targetItems ?? profile.targetLinearItems
    const repetitions = Math.max(1, Math.min(250, Math.ceil(targetItems / benchmarkCase.size)))

    for (let index = 0; index < profile.warmups; index += 1) {
        runRepeated(benchmarkCase, repetitions)
    }

    const samples: number[] = []

    for (let index = 0; index < profile.samples; index += 1) {
        bun.gc(true)

        const startedAt = bun.nanoseconds()
        runRepeated(benchmarkCase, repetitions)
        const elapsed = bun.nanoseconds() - startedAt

        samples.push(elapsed / repetitions)
    }

    samples.sort((left, right) => left - right)

    const medianNs = percentile(samples, 0.5)
    const p95Ns = percentile(samples, 0.95)
    const minNs = samples[0] ?? 0
    const maxNs = samples.at(-1) ?? 0
    const operationsPerSecond = medianNs === 0 ? Number.POSITIVE_INFINITY : 1_000_000_000 / medianNs

    return {
        id: benchmarkCase.id,
        category: benchmarkCase.category,
        name: benchmarkCase.name,
        size: benchmarkCase.size,
        repetitions,
        samples: profile.samples,
        medianMs: medianNs / 1_000_000,
        p95Ms: p95Ns / 1_000_000,
        minMs: minNs / 1_000_000,
        maxMs: maxNs / 1_000_000,
        operationsPerSecond,
        itemsPerSecond: operationsPerSecond * benchmarkCase.size,
        ...(benchmarkCase.baselineId === undefined ? {} : { baselineId: benchmarkCase.baselineId }),
        headline: benchmarkCase.headline ?? false,
    }
}

function runRepeated(benchmarkCase: BenchmarkCase, repetitions: number): void {
    for (let index = 0; index < repetitions; index += 1) {
        sink += benchmarkCase.run()
    }
}

function applyBaselines(allResults: BenchmarkResult[]): void {
    const byId = new Map(allResults.map((result) => [result.id, result] as const))

    for (let index = 0; index < allResults.length; index += 1) {
        const result = allResults[index]!
        if (!result.baselineId) continue

        const baseline = byId.get(result.baselineId)
        if (!baseline || baseline.medianMs === 0) continue

        allResults[index] = {
            ...result,
            relativeToBaseline: result.medianMs / baseline.medianMs,
        }
    }
}

function printResults(allResults: readonly BenchmarkResult[]): void {
    console.log("\nMeasured results")
    console.table(allResults.map((result) => ({
        category: result.category,
        benchmark: result.name,
        items: formatInteger(result.size),
        repeats: result.repetitions,
        "median ms": formatDecimal(result.medianMs),
        "p95 ms": formatDecimal(result.p95Ms),
        "items/sec": formatRate(result.itemsPerSecond),
        "vs native": result.relativeToBaseline === undefined
            ? "—"
            : `${result.relativeToBaseline.toFixed(2)}x`,
    })))

    const million = allResults.filter((result) => result.headline && result.size === 1_000_000)
    if (million.length === 0) return

    console.log("\nOne-million-item collection results")
    for (const result of million) {
        console.log(
            `${result.name}: ${formatDecimal(result.medianMs)} ms median, `
            + `${formatRate(result.itemsPerSecond)} items/sec`,
        )
    }
}

function renderMarkdown(report: BenchmarkReport): string {
    const million = report.results.filter((result) => result.headline && result.size === 1_000_000)
    const fastest = [...million].sort((left, right) => left.medianMs - right.medianMs)[0]

    const lines = [
        "# @obvia/collections benchmark",
        "",
        `Profile: **${report.profile}** · Bun **${report.runtime.version}** · ${report.methodology.samples} measured samples after ${report.methodology.warmups} warmups.`,
        "",
        "> Timings below are measured by `Bun.nanoseconds()` on the current GitHub Actions runner. They are not estimates, guarantees, or hard-coded marketing numbers.",
        "",
    ]

    if (fastest) {
        lines.push(
            "## One-million-item headline",
            "",
            `Fastest full one-million-item Collection workload in this run: **${fastest.name}** completed in **${formatDecimal(fastest.medianMs)} ms median** (${formatRate(fastest.itemsPerSecond)} items/sec).`,
            "",
            "| Collection operation | Median | p95 | Throughput | vs native |",
            "| --- | ---: | ---: | ---: | ---: |",
            ...million.map((result) => `| ${escapeMarkdown(result.name)} | ${formatDecimal(result.medianMs)} ms | ${formatDecimal(result.p95Ms)} ms | ${formatRate(result.itemsPerSecond)} items/s | ${formatRelative(result.relativeToBaseline)} |`),
            "",
        )
    }

    lines.push(
        "## Complete results",
        "",
        "| Category | Benchmark | Items | Median | p95 | Throughput | vs native |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
        ...report.results.map((result) => `| ${result.category} | ${escapeMarkdown(result.name)} | ${formatInteger(result.size)} | ${formatDecimal(result.medianMs)} ms | ${formatDecimal(result.p95Ms)} ms | ${formatRate(result.itemsPerSecond)} items/s | ${formatRelative(result.relativeToBaseline)} |`),
        "",
        "## Methodology",
        "",
        `- Dataset sizes: ${profile.sizes.map(formatInteger).join(", ")} items.`,
        `- ${report.methodology.warmups} warmup rounds before ${report.methodology.samples} measured samples per benchmark.`,
        "- Each measured sample performs enough repetitions to process at least the configured target item count; reported milliseconds are normalized back to one operation.",
        "- Synchronous garbage collection runs before each measured sample, never inside the timed region.",
        "- Input arrays and Collections are prepared outside the timed region except explicit construction benchmarks.",
        "- Native JavaScript baselines use the same source data and equivalent semantics where a meaningful comparison exists.",
        "- Median is the primary number; p95 is included to expose runner variance.",
        "",
    )

    return `${lines.join("\n")}\n`
}

function resolveProfile(): BenchmarkProfile {
    const argument = bun.argv.find((value) => value.startsWith("--profile="))
    const requested = argument?.slice("--profile=".length) ?? bun.env.COLLECTION_BENCH_PROFILE ?? "quick"

    if (requested !== "quick" && requested !== "ci" && requested !== "thorough") {
        throw new RangeError(`Unknown benchmark profile: ${requested}`)
    }

    return profiles[requested]
}

function percentile(values: readonly number[], ratio: number): number {
    const index = Math.min(
        values.length - 1,
        Math.max(0, Math.ceil(values.length * ratio) - 1),
    )

    return values[index] ?? 0
}

function formatResultLine(result: BenchmarkResult): string {
    return [
        result.category.padEnd(12),
        result.name.padEnd(42),
        `${formatInteger(result.size).padStart(9)} items`,
        `${formatDecimal(result.medianMs).padStart(9)} ms median`,
        `${formatDecimal(result.p95Ms).padStart(9)} ms p95`,
    ].join("  ")
}

function formatInteger(value: number): string {
    return Math.round(value).toLocaleString("en-US")
}

function formatDecimal(value: number): string {
    if (value >= 100) return value.toFixed(1)
    if (value >= 10) return value.toFixed(2)
    return value.toFixed(3)
}

function formatRate(value: number): string {
    if (!Number.isFinite(value)) return "∞"
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`
    return formatInteger(value)
}

function formatRelative(value: number | undefined): string {
    return value === undefined ? "—" : `${value.toFixed(2)}x`
}

function escapeMarkdown(value: string): string {
    return value.replaceAll("|", "\\|")
}

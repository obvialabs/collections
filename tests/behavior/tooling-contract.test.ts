import { describe, expect, test } from "bun:test"

type PackageJson = {
    author?: string
    files?: string[]
    publishConfig?: Record<string, unknown>
    scripts?: Record<string, string>
}

async function readJson<T>(path: string): Promise<T> {
    return JSON.parse(await Bun.file(new URL(path, import.meta.url)).text()) as T
}

async function readText(path: string): Promise<string> {
    return Bun.file(new URL(path, import.meta.url)).text()
}

describe("tooling contract", () => {
    test("runtime test scripts use Bun and never fall back to Node's test runner", async () => {
        const packageJson = await readJson<PackageJson>("../../package.json")
        const scripts = packageJson.scripts ?? {}
        const testScripts = Object.entries(scripts)
            .filter(([name]) => name === "test" || name.startsWith("test:"))
            .map(([, command]) => command)
            .join("\n")

        expect(testScripts).toContain("bun test")
        expect(testScripts).not.toContain("node --test")
        expect(testScripts).not.toContain("node:test")
        expect(testScripts).not.toContain("node:assert")
    })

    test("correctness, coverage, type contracts and benchmarks stay separate concerns", async () => {
        const packageJson = await readJson<PackageJson>("../../package.json")
        const scripts = packageJson.scripts ?? {}

        expect(scripts["test:runtime"]).toContain("tests/contracts")
        expect(scripts["test:runtime"]).toContain("tests/properties")
        expect(scripts["test:runtime"]).toContain("tests/performance")
        expect(scripts["test:coverage"]).toContain("--coverage")
        expect(scripts["test:types"]).toContain("tsconfig.types.json")
        expect(scripts.benchmark).toContain("benchmarks/collection.bench.ts")
        expect(scripts.test).not.toContain("benchmark")
    })

    test("coverage configuration emits text and LCOV while enforcing source coverage", async () => {
        const bunfig = await readText("../../bunfig.toml")

        expect(bunfig).toContain("coverageSkipTestFiles = true")
        expect(bunfig).toContain("coverageThreshold = 1.0")
        expect(bunfig).toContain('coverageReporter = ["text", "lcov"]')
        expect(bunfig).toContain('coverageDir = "coverage"')
    })

    test("publishes the detailed API documentation with the package", async () => {
        const packageJson = await readJson<PackageJson>("../../package.json")

        expect(packageJson.files).toContain("docs")
    })

    test("keeps tests, coverage and benchmarks in independent GitHub workflows", async () => {
        const [testWorkflow, coverageWorkflow, benchmarkWorkflow] = await Promise.all([
            readText("../../.github/workflows/test.yml"),
            readText("../../.github/workflows/coverage.yml"),
            readText("../../.github/workflows/benchmark.yml"),
        ])

        expect(testWorkflow).toContain("bun run test")
        expect(testWorkflow).toContain("bun run typecheck")
        expect(testWorkflow).not.toContain("test:coverage")
        expect(testWorkflow).not.toContain("benchmark")

        expect(coverageWorkflow).toContain("bun run test:coverage")
        expect(coverageWorkflow).toContain("actions/upload-artifact@v4")
        expect(coverageWorkflow).toContain("coverage/lcov.info")
        expect(coverageWorkflow).not.toContain("bun run benchmark")

        expect(benchmarkWorkflow).toContain("bun run benchmark")
        expect(benchmarkWorkflow).toContain("workflow_dispatch")
        expect(benchmarkWorkflow).toContain("schedule:")
        expect(benchmarkWorkflow).toContain("benchmark-results.txt")
        expect(benchmarkWorkflow).not.toContain("test:coverage")
    })

    test("prepares manual publish artifacts from a clean build and ships source-map sources", async () => {
        const packageJson = await readJson<PackageJson>("../../package.json")
        const scripts = packageJson.scripts ?? {}

        expect(packageJson.files).toContain("dist")
        expect(packageJson.files).toContain("src")
        expect(packageJson.files).toContain("docs")
        expect(packageJson.author).toBe("Selçuk Çukur <selcukcukur@outlook.com.tr>")
        expect(packageJson.publishConfig?.access).toBe("public")
        expect(packageJson.publishConfig?.provenance).toBeUndefined()
        expect(scripts.prepack).toContain("bun run clean")
        expect(scripts.prepack).toContain("bun run build")
        expect(scripts["verify:package"]).toContain("npm pack --dry-run")
        expect(scripts.prepublishOnly).toBe("bun run check")
        expect(await Bun.file(new URL("../../.npmignore", import.meta.url)).exists()).toBe(false)
    })

    test("keeps publishing manual instead of adding a package or release workflow", async () => {
        const candidates = [
            "../../.github/workflows/package.yml",
            "../../.github/workflows/publish.yml",
            "../../.github/workflows/release.yml",
        ]

        for (const path of candidates) {
            expect(await Bun.file(new URL(path, import.meta.url)).exists()).toBe(false)
        }
    })
})

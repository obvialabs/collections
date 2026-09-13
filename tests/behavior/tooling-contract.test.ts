import { describe, expect, test } from "bun:test"

type PackageJson = {
    scripts?: Record<string, string>
}

async function readJson<T>(path: string): Promise<T> {
    return JSON.parse(await Bun.file(new URL(path, import.meta.url)).text()) as T
}

describe("test and release tooling contract", () => {
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

    test("coverage configuration guards production source rather than counting test files", async () => {
        const bunfig = await Bun.file(new URL("../../bunfig.toml", import.meta.url)).text()

        expect(bunfig).toContain("coverageSkipTestFiles = true")
        expect(bunfig).toContain("coverageThreshold = 1.0")
        expect(bunfig).toContain('coverageReporter = "text"')
    })
})

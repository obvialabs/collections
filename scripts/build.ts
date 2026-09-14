import { rmSync } from "node:fs"

/**
 * Builds the public runtime entrypoints with Bun's native bundler.
 *
 * Keeping the build configuration in TypeScript avoids shell-specific CLI
 * parsing differences between Windows and Unix environments. Code splitting
 * also ensures shared implementation modules are not duplicated across the
 * root and subpath entrypoints.
 */
rmSync("dist", { recursive: true, force: true })

const result = await Bun.build({
    entrypoints: [
        "./src/index.ts",
        "./src/collection.ts",
        "./src/collect.ts",
    ],
    root: "./src",
    outdir: "./dist",
    target: "browser",
    format: "esm",
    sourcemap: "linked",
    packages: "external",
    splitting: true,
})

if (!result.success) {
    for (const log of result.logs) {
        console.error(log)
    }

    process.exit(1)
}

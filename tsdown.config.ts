import { defineConfig } from "tsdown"

/**
 * Builds the publishable package while preserving the source module structure.
 *
 * The build emits ESM and CommonJS runtimes, source maps and TypeScript
 * declarations without collapsing the package into a single bundled module.
 */
export default defineConfig({
    // Public package entry points.
    entry     : [
        "src/index.ts",
        "src/collection.ts",
        "src/collect.ts",
    ],

    // Resolve source modules relative to the package source directory.
    root      : "src",

    // Write every generated artifact to the publishable distribution directory.
    outDir    : "dist",

    // Emit both modern ESM and CommonJS runtimes for package consumers.
    format    : ["esm", "cjs"],

    // Keep the output runtime-neutral so consumers can use any compatible runtime.
    platform  : "neutral",

    // Remove previous build artifacts before generating a fresh distribution.
    clean     : true,

    // Preserve the source module layout instead of collapsing it into one bundle.
    unbundle  : true,

    // Generate source maps for emitted JavaScript files.
    sourcemap : true,

    // Generate TypeScript declarations and declaration source maps.
    dts       : {
        sourcemap: true,
    },
})

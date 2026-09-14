import { defineConfig } from "tsdown"

/**
 * Builds the publishable package without changing the source module structure.
 *
 * The package intentionally uses an unbundled library build. Each source module
 * remains independently inspectable in `dist`, public JSDoc is preserved, and
 * consumers receive both ESM and CommonJS runtimes plus declaration files.
 */
export default defineConfig({
    entry: [
        "src/index.ts",
        "src/collection.ts",
        "src/collect.ts",
    ],
    root: "src",
    outDir: "dist",
    format: ["esm", "cjs"],
    platform: "neutral",
    target: false,
    fixedExtension: false,
    clean: true,
    unbundle: true,
    treeshake: false,
    minify: false,
    hash: false,
    sourcemap: true,
    dts: {
        sourcemap: true,
    },
    failOnWarn: true,
    outputOptions: {
        // Keep public API JSDoc/docblocks in generated JavaScript as well as in
        // declarations. Regular implementation comments may still be omitted.
        comments: true,
    },
})

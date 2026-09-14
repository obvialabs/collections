# Changelog

All notable changes to `@obvia/collections` are documented in this file.

## Unreleased

- Replaced the shell-sensitive Bun build CLI with a typed `scripts/build.ts` using `Bun.build()`, including linked source maps and code splitting for shared multi-entrypoint implementation; this fixes Windows interpreting `linked` as an entrypoint.
- Consolidated source, build scripts, benchmarks, runtime tests, and compile-time contracts under one `tsconfig.json`; removed `tsconfig.types.json` / `test:types` and added `@types/bun` for Bun-native project typing.
- Switched runtime builds from TypeScript emit to Bun's native bundler, with explicit source-rooted ESM entrypoints and source maps; published `types` conditions now resolve directly to the TypeScript source instead of generated declarations.
- Decoupled runtime tests and benchmarks from build artifacts by routing them through the package-internal `#collections` source alias, so `bun:test`, coverage, and benchmarks run directly against `src` without a prerequisite build.
- Upgraded static verification to TypeScript 7.0.2, which is retained only as a no-emit type checker for source and compile-time contracts rather than as the package build pipeline.
- Optimized allocation-heavy transforms by building owned result maps in one pass for `map()`, `filter()`, key-mapping operations, `groupBy()`, and `countBy()` while preserving defensive copies for every externally supplied `Map`.
- Optimized positive `take()` to stop after the requested prefix instead of materializing the entire source, which directly reduces work in fluent pipelines such as `filter().take().pluck().sum()`.
- Optimized numeric `sum()` / `average()` hot paths to iterate storage directly without an intermediate `reduce()` callback layer, and specialized common one/two-field `select()` projections.
- Strengthened benchmarks so transform outputs are consumed, lookup throughput is reported as lookups/sec rather than items/sec, and the README now surfaces reproducible one-million-item CI measurements.
- Fixed LCOV artifact generation by removing the `[test] coverage = false` override that suppressed CLI `--coverage`; reporter, threshold and output settings now live in one `bunfig.toml` configuration and CI verifies the generated report before upload.
- Modernized GitHub Actions to consistent `tests / collections`, `coverage / collections`, and `benchmark / collections` checks using current checkout/artifact actions and the package-pinned Bun runtime.
- Rebuilt benchmarks around measured 10K/100K/1M workloads with Bun high-resolution timing, warmups, median/p95 statistics, native baselines, runner metadata, and machine-readable reports.
- Unified collection creation around `collect()` and removed `createCollection()`, definition `id` injection, and direct Collection-key properties. Object records now use the same immutable Collection model as arrays, maps, and entry iterables.
- Preserved literal object keys and key-specific `toObject()` value types for object sources while keeping Collection methods collision-free.
- Added a high-value immutable collection expansion covering adjacency/cardinality queries, variable windows, keyed shaping, association-aware sets, tuple pipelines, range/class filtering, projections, dot paths and conditional flow helpers.
- Added behavior, guard, property, type-contract and performance coverage for the expanded API surface.
- Aligned object-record collection behavior with `Object.entries()`: numeric keys normalize to strings, symbol-only properties stay excluded, custom-prototype records are accepted, and structured instances remain rejected.
- Made `median()` use the package's deterministic numeric ordering when `NaN` is present.
- Hardened `toObject()`, `flatMap()`, `flatten()`, `pad()` and `append()` against property-key collisions, argument-spread limits and deep recursive inputs.
- Added clean prepack/package verification scripts while keeping npm publishing explicitly manual with no publish workflow.
- Added a manual release checklist and made test/coverage/benchmark workflows bounded and less redundant.
- Reworked the package documentation into a concise usage-focused README plus a complete published `docs/api.md` reference.
- Added independent GitHub Actions workflows for tests, LCOV coverage, and scheduled/manual benchmarks.
- Completed behavior-contract coverage for the full existing public API without adding new collection features.
- Added detailed creation, conversion, access, transformation, filtering, ordering, grouping, set/update, flow, aggregate, edge-case and negative-behavior tests.
- Added property/law checks, deterministic performance-work tests, expanded README/API documentation and a broader benchmark matrix.
- Added compile-time contracts for literal object keys, method-name collisions, nested paths, optional nested branches, narrowing and fluent return types.
- Fixed optional nested path value inference so valid optional branches resolve to `T | undefined`.
- Made scalar ordering deterministic for `null`, `undefined`, `NaN`, bigint, dates and string-comparable values.
- Resolved `sortBy()` / `sortByDesc()` callback selectors once per source entry instead of repeatedly inside the comparator.
- Prevented `append()` from replacing entries keyed by `NaN`, infinite numbers or precision-edge numeric keys.
- Avoided shuffle/RNG work for `random(0)`.
- Expanded the README with unified creation guidance, behavior guarantees, method contracts, usage recipes, mistakes, test strategy and benchmark guidance.
- Migrated all runtime tests to `bun:test` and removed the Node test-runner dependency from the test workflow.
- Added unit, behavioral, guard, property-style and expanded compile-time contract coverage across the public API.
- Added coverage and benchmark scripts for Bun-based development and regression profiling.
- Hardened integer argument validation for sequence operations and random selection.
- Fixed negative-offset slicing with explicit lengths and balanced `split()` group allocation.
- Preserved stable relative ordering when descending selectors compare equal.

## 0.1.0

- Added immutable `Collection<TKey, TValue>` with fluent transforms, filtering, slicing, ordering, grouping, set operations, aggregation and iteration.
- Added `collect()` for arrays, maps, entry iterables, object records and existing collections with literal object-key inference.
- Added strongly typed dot-path selectors for nested `pluck`, `where`, `groupBy`, `keyBy`, `sortBy`, `countBy` and `implode` operations.
- Added runtime and compile-time tests for core, transformation and advanced collection behavior.

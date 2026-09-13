# Changelog

All notable changes to `@obvia/collections` are documented in this file.

## Unreleased

- Completed behavior-contract coverage for the full existing public API without adding new collection features.
- Added detailed creation, conversion, access, transformation, filtering, ordering, grouping, set/update, flow, aggregate, edge-case and negative-behavior tests.
- Added property/law checks, deterministic performance-work tests, README/API documentation contracts and an expanded benchmark matrix.
- Added compile-time contracts for literal definition IDs, collisions, nested paths, optional nested branches, narrowing and fluent return types.
- Fixed optional nested path value inference so valid optional branches resolve to `T | undefined`.
- Made scalar ordering deterministic for `null`, `undefined`, `NaN`, bigint, dates and string-comparable values.
- Resolved `sortBy()` / `sortByDesc()` callback selectors once per source entry instead of repeatedly inside the comparator.
- Prevented `append()` from replacing entries keyed by `NaN`, infinite numbers or precision-edge numeric keys.
- Avoided shuffle/RNG work for `random(0)`.
- Expanded the README with a direct `collect()` versus `createCollection()` decision guide, behavior guarantees, method contracts, usage recipes, mistakes, test strategy and benchmark guidance.
- Migrated all runtime tests to `bun:test` and removed the Node test-runner dependency from the test workflow.
- Added unit, behavioral, guard, property-style and expanded compile-time contract coverage across the public API.
- Added coverage and benchmark scripts for Bun-based development and regression profiling.
- Hardened integer argument validation for sequence operations and random selection.
- Fixed negative-offset slicing with explicit lengths and balanced `split()` group allocation.
- Preserved stable relative ordering when descending selectors compare equal.

## 0.1.0

- Added immutable `Collection<TKey, TValue>` with fluent transforms, filtering, slicing, ordering, grouping, set operations, aggregation and iteration.
- Added `collect()` for arrays, maps, entry iterables, plain objects and existing collections.
- Added `createCollection()` for keyed definitions with literal `id` inference and safe direct item access.
- Added strongly typed dot-path selectors for nested `pluck`, `where`, `groupBy`, `keyBy`, `sortBy`, `countBy` and `implode` operations.
- Added runtime and compile-time tests for core, transformation and advanced collection behavior.

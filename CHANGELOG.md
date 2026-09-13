# Changelog

All notable changes to `@obvia/collections` are documented in this file.

## Unreleased

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

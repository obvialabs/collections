# Changelog

All notable changes to `@obvia/collections` are documented in this file.

## 0.1.0

- Added immutable `Collection<TKey, TValue>` with fluent transforms, filtering, slicing, ordering, grouping, set operations, aggregation and iteration.
- Added `collect()` for arrays, maps, entry iterables, plain objects and existing collections.
- Added `createCollection()` for keyed definitions with literal `id` inference and safe direct item access.
- Added strongly typed dot-path selectors for nested `pluck`, `where`, `groupBy`, `keyBy`, `sortBy`, `countBy` and `implode` operations.
- Added runtime and compile-time tests for core, transformation and advanced collection behavior.

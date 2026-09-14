# Changelog

## v0.1.0 - 2026-09-14

We're excited to announce the first public release of **@obvia/collections**. 🎉

**@obvia/collections** is an immutable, fluent, and deeply typed collection library for TypeScript focused on predictable data transformations, meaningful key preservation, and strong type inference.

* One creation model through `collect()` for arrays, object records, maps, entry iterables, and existing collections
* Immutable `Collection<TKey, TValue>` operations with more than 130 fluent collection methods
* Literal object-key inference and key-specific `get()` / `toObject()` typing
* Strongly typed nested paths for `pluck`, `where`, `groupBy`, `keyBy`, `sortBy`, `countBy`, `implode`, and related operations
* Key-preserving transforms, filtering, projections, grouping, ordering, set operations, aggregation, windowing, and flow helpers
* Collection-specific errors for required selection operations such as `firstOrFail()`, `lastOrFail()`, and `sole()`
* Runtime hardening for null-prototype records, custom-prototype records, deep iterables, property-key collisions, invalid arguments, and numeric edge cases
* Allocation-focused performance optimizations for transforms, projections, grouping, path resolution, ordering, aggregation, and fluent pipelines
* Bun-based unit, behavioral, contract, guard, property, and deterministic performance test suites
* Compile-time type contracts covering literal keys, nested paths, narrowing, fluent return types, and invalid inputs
* Reproducible benchmark suites for 10K, 100K, and 1M-item workloads with equivalent native JavaScript and `Map` baselines
* ESM and CommonJS package outputs, generated TypeScript declarations, source maps, and declaration maps through `tsdown`
* Usage-focused package documentation, a complete API reference, and a manual release workflow

This release establishes the foundation of the **@obvia/collections** package. Future releases will continue to focus on API refinement, performance improvements, stronger type inference, expanded examples, and developer experience enhancements.

Thank you to everyone following the project and providing feedback during development. 🚀

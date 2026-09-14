# Contributing

The **@obvia/collections** project welcomes contributions from the community.

Whether you want to report a bug, suggest a new feature, improve the documentation, or submit code changes, your contributions are greatly appreciated.

## Development

Install dependencies and run the verification suite with Bun:

```bash
bun install
bun run test
bun run test:coverage
bun run benchmark
bun run build
```

Keep runtime behavior, type contracts, documentation, and benchmarks aligned with any public API change. Runtime tests use `bun:test`, while compile-time contracts live under `tests/types`.

## Pull requests

Keep changes focused, preserve existing public contracts unless the change intentionally updates them, and include appropriate tests and documentation for user-visible behavior.

Before submitting a pull request, run:

```bash
bun run check
bun run verify:package
```

Publishing is handled manually by the project maintainer and is not part of the contribution workflow.

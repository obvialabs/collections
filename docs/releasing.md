# Releasing `@obvia/collections`

Publishing is intentionally manual. The repository does not contain a publish, release, or package-upload workflow.

## Before publishing

Run the full verification suite from a clean checkout:

```bash
bun install
bun run check
bun run test:coverage
bun run benchmark
bun run verify:package
```

`verify:package` performs a clean build and runs an npm pack dry-run so the files that would be published can be inspected without publishing anything.

## Inspect the package

Create the tarball locally:

```bash
npm pack
```

Inspect its contents before publishing:

```bash
tar -tzf obvia-collections-*.tgz
```

The package should contain the compiled `dist` output, source files required by source/declaration maps, documentation, changelog, license, README, and package metadata. Test files, benchmark sources, Git metadata, and CI configuration should not be present.

## Publish

After updating the package version and changelog, publish manually:

```bash
npm publish --access public
```

The package intentionally does not enable automated provenance or CI publishing. Release authentication and the final publish command remain an explicit local operator action.

## After publishing

Verify the published version and exports from a clean consumer project before announcing the release.

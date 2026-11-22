# Vendored Axiomatic sources

This site runs the real Axiomatic Color and Axiomatic Layout. Neither is
published to a registry, so the exact files the site builds from are kept
here. A clean checkout builds with no other repository beside it.

| Directory | What it holds | Upstream | License |
| --- | --- | --- | --- |
| `axiomatic-layout/` | Four source files, byte for byte: the authored-element adapter, the shared Switcher coordinator and their two stylesheets | [design-axioms/axiomatic-layout](https://github.com/design-axioms/axiomatic-layout) at `1e06846cd5b94c4c070032d31adb54b1a219e526` | None declared upstream at this revision |
| `design-axioms-color/` | The `@design-axioms/color` 0.1.0 package tarball, built from source | [design-axioms/axiomatic-color](https://github.com/design-axioms/axiomatic-color) at `43ed52b4d80cf340a16f99335f4d76025ab0779e` | MIT, as stated in its `package.json` and README |

Each directory's `provenance.json` is the record: the upstream repository,
the full commit, and a SHA-256 for every file (for Color, the tarball and
each file inside it). `pnpm validate` and the tests fail if anything here
differs from its record.

## Licenses

Axiomatic Color declares MIT in its package manifest and README. Its
repository has no separate license file at this revision, so there is no
notice text to carry. The generated stylesheet names the package, its
license and its revision in its first line.

Axiomatic Layout declares no license at this revision. Both projects belong
to the same organization as this site. Layout's license needs settling
upstream before anyone outside the organization reuses these files.

## Do not edit these files

A change to Layout or Color belongs in its own repository, with its own
review and evidence. Then vendor the new revision here. A local edit fails
the checks.

The Layout files are an experimental integration surface, not a published
API. This site imports them by path, so no package name or entry point is
implied.

## Updating

Both commands read a named commit out of a local clone with git. They never
read the clone's working tree, and they need the full 40-character commit.

```sh
node scripts/vendor.ts layout ../layout <commit>
node scripts/vendor.ts color ../color <commit>
node scripts/vendor.ts check
```

`layout` copies the four files and rewrites their record. `color` exports
the commit to a temporary directory, installs its locked dependencies
without running install scripts, runs the package's own build and
`pnpm pack`, then records the result. If the package version changes, update the tarball path in
`package.json`. Run `pnpm install` to refresh the lockfile after updating Color.

The recorded toolchain produced a byte-identical tarball in an independent
clean build. The per-file hashes also let you compare its contents.

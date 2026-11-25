# Axiomatic packages used by the homepage

The homepage installs both packages from local archives. A clean checkout builds without a sibling repository or a registry release.

| Directory | What it holds | Source and revision |
| --- | --- | --- |
| `axiomatic-layout/` | The experimental `@design-axioms/layout` package, including native group registration and group styles | [Layout provenance](axiomatic-layout/provenance.json) |
| `design-axioms-color/` | The `@design-axioms/color` package used to generate the site's palette | [Color provenance](design-axioms-color/provenance.json) |

Each record names the upstream repository, full commit and build tools. It records a SHA-256 for the tarball and each file inside. The tests and `pnpm validate` check them.

## Licenses

Color declares MIT in its package manifest and README. Its repository has no separate license file at this revision. The generated stylesheet names the package, its license and its revision.

Layout declares no license at this revision. Both projects belong to the same organization as this site. Layout's license needs settling upstream before anyone outside the organization reuses it.

## Updating

Make changes in the upstream repository first. The update command exports the full named commit from a local clone, installs its locked dependencies, builds the package, runs `pnpm pack`, and updates the provenance record.

```sh
node scripts/vendor.ts layout ../layout <commit>
node scripts/vendor.ts color ../color <commit>
node scripts/vendor.ts check
```

If the package version changes, update its archive path in `package.json`. Run `pnpm install` to refresh the lockfile after replacing the archive.

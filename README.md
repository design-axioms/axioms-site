# Axiomatic home (`axioms.design`)

The shared front door for **Axiomatic** at <https://axioms.design/>, introducing
the relationship-first design model and linking to Axiomatic Layout
(<https://layout.axioms.design>) and Axiomatic Color
(<https://color.axioms.design>).

Read [the website architecture plan](docs/WEBSITE-PLAN.md) for the roadmap
across `axioms.design`, Color, Layout, and the sequenced `ts-docs` follow-up.

## Local development & validation

Use Node 24 and pnpm 10 (see `.node-version` and `package.json`):

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Run all checks locally:

```sh
pnpm check
pnpm build
pnpm validate
```

Static build output is written to `dist/`, keeping repository documentation
(`README.md`, `CONTRIBUTING.md`, `docs/`) outside the web root.

## Pinned Color & Layout snapshots

This repository builds standalone in CI and on Vercel without requiring sibling
checkouts:

- `@design-axioms/color` is installed from its pinned tarball under `vendor/`.
- Layout's bare primitive runtime and `authored-elements` adapter are vendored
  under `vendor/axiomatic-layout/`.
- `vendor/provenance.json` records the source repository, commit SHA, and
  SHA-256 hash of every vendored file, verified by `pnpm validate`.

To refresh snapshots intentionally from sibling `../color` and `../layout`
checkouts, build `../color` first and run:

```sh
pnpm vendor:sync
pnpm install
```

## Publish the static site

Deploy this repository to the dedicated `axioms-site` project in
`yehuda-katzs-projects`, after review and approval:

```sh
pnpm check && pnpm build && pnpm validate
vercel deploy --prod --yes --scope yehuda-katzs-projects --project axioms-site
```

Deployment is explicit through the CLI; GitHub checks do not deploy
automatically. The Layout and Color projects keep their own deployments.

### Domain & link-preservation commitments

- Keep `axiomatic-layout.vercel.app` serving the Layout playground without a
  custom-domain redirect: its browser-local drafts belong to that origin.
- Preserve `www.axioms.design` (or a dedicated `v1.color.axioms.design` archive)
  for legacy Color v1 links until a deliberate retirement/redirect pass is
  prepared.
- `vercel.json` redirects legacy Color v1 prefixes (`/concepts/*`, `/guides/*`,
  `/theory/*`, `/catalog/*`, `/advanced/*`, `/reference/*`, `/why-axiomatic`,
  `/philosophy`, `/alpha-limitations`, `/llms.txt`, `/llms-full.txt`) to
  `https://www.axioms.design/`, while leaving `/`, `/assets/*`, and future
  secondary pages free to serve from `dist/`.
- The original Color domain assignment was `axioms.design` redirecting to
  `www.axioms.design` on Vercel project `color-site`. Record any changed domain
  assignment and rollback plan before altering apex or subdomain bindings.

## Contribute

Development lives in
[design-axioms/axioms-site](https://github.com/design-axioms/axioms-site).
Changes to `main` go through pull requests and required CI. See
[CONTRIBUTING.md](CONTRIBUTING.md) for checks, review, and merge approval.

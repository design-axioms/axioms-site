# Axiomatic home (`axioms.design`)

The shared front door for **Axiomatic** at <https://axioms.design/>, introducing
the relationship-first design model and linking to Axiomatic Layout
(<https://layout.axioms.design>) and Axiomatic Color
(<https://color.axioms.design>).

Read [the website architecture plan](docs/WEBSITE-PLAN.md) for the roadmap
across `axioms.design`, Color, Layout, and the sequenced `ts-docs` follow-up.

## Local preview & validation

Use Node 24 (see `.node-version`):

```sh
node scripts/validate.mjs
python3 -m http.server 8789 --bind 127.0.0.1 --directory public
```

Published static files live under `public/` so repository documentation
(`README.md`, `CONTRIBUTING.md`, `docs/`) stays outside the web root.

## Publish the static site

Deploy this repository to the dedicated `axioms-site` project in
`yehuda-katzs-projects`, after review and approval:

```sh
node scripts/validate.mjs
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
- `vercel.json` currently redirects non-root apex requests (`/:path(.+)`) to
  `www.axioms.design`. Because Vercel evaluates `redirects` before static files,
  narrow that catch-all to legacy Color v1 prefixes before publishing secondary
  pages or external assets under `public/` (see
  [docs/WEBSITE-PLAN.md](docs/WEBSITE-PLAN.md)).
- The original Color domain assignment was `axioms.design` redirecting to
  `www.axioms.design` on Vercel project `color-site`. Record any changed domain
  assignment and rollback plan before altering apex or subdomain bindings.

## Contribute

Development lives in
[design-axioms/axioms-site](https://github.com/design-axioms/axioms-site).
Changes to `main` go through pull requests and required CI. See
[CONTRIBUTING.md](CONTRIBUTING.md) for checks, review, and merge approval.

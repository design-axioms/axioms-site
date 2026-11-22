# Contributing to Axiomatic Site

Read [the website architecture plan](docs/WEBSITE-PLAN.md) before changing the
site structure, routing rules, or Color/Layout integration boundary.

## Make changes through a pull request

Create a branch from the latest `main` (agent branches use `wycats/`), make a
focused change, and open a ready pull request. Explain why it matters and what
evidence supports the resulting behavior.

Use the Node version in `.node-version` and the pnpm version in
`package.json`:

```sh
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` checks types and formatting, runs the tests, builds `dist/`
and validates what was built. `pnpm format` fixes formatting. Author
TypeScript and ESM; Node runs the scripts and tests directly.

For changes to interactions, run the browser check as well:

```sh
pnpm exec playwright install chromium firefox webkit
pnpm test:browser
```

The `CI` workflow runs `pnpm verify` on every PR. Its `Validate` check is
required by the active `main` ruleset. The PR must be up to date with `main`,
and review conversations must be resolved. Direct pushes, branch deletion,
and force pushes are blocked; no actors have a bypass. GitHub Actions is the
required check's source.

## Working with upstream Color and Layout

Use Axiomatic Color's surface, hue, text and border classes when applying
color. The validation step checks those class names against the published
stylesheets to catch typos.

The files under [`vendor/`](vendor/README.md) are exact upstream revisions.
Fix a problem in Color or Layout upstream and vendor the new revision; a
local edit fails the checks.

Request Codex review and address its findings before merging. Agent-authored
review threads may be resolved after the issue is conclusively fixed. Obtain
Yehuda's approval before merging.

## Deployment & routing safety

Vercel publishes the protected `main` branch when a PR merges. Site checks run
against a local build on PRs and against the public domain after Vercel
reports a successful production deployment to GitHub. See [the release
workflow](README.md#publish-the-static-site) to rerun the hosted checks.

The apex forwards the earlier Color site's paths to `www.axioms.design`;
[README.md](README.md#domain--link-preservation-commitments) lists them.
Keep new pages and assets outside those paths. When `vercel.json` changes,
check both directions with `pnpm serve`: a legacy path answers `307` to the
same path on `www.axioms.design`, and each of this site's files answers
`200`. The tests compile the rules with Vercel's own routing package, and
validation fails if a built file would be forwarded.

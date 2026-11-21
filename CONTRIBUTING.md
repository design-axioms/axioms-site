# Contributing to Axiomatic Site

Read [the website architecture plan](docs/WEBSITE-PLAN.md) before changing the
site structure, routing rules, or Color/Layout integration boundary.

## Make changes through a pull request

Create a branch from the latest `main` (agent branches use `wycats/`), make a
focused change, and open a ready pull request. Explain why it matters and what
evidence supports the resulting behavior.

Use the Node version in `.node-version`:

```sh
node scripts/validate.mjs
```

The `CI` workflow runs this check on every PR. Its `Validate` check is required
by the active `main` ruleset. The PR must be up to date with `main`, and review
conversations must be resolved. Direct pushes, branch deletion, and force pushes
are blocked; no actors have a bypass. GitHub Actions is the required check's
source.

Request Codex review and address its findings before merging. Agent-authored
review threads may be resolved after the issue is conclusively fixed. Obtain
Yehuda's approval before merging.

## Deployment & routing safety

Production deployment remains an explicit CLI action using the procedure in
[README.md](README.md#publish-the-static-site). PR checks do not hold deployment
credentials or publish the site.

Before adding secondary pages or external assets under `public/`, narrow
`vercel.json`'s catch-all `/:path(.+)` redirect to legacy Color v1 prefixes and
verify both new routes and legacy redirects against a preview or local check.

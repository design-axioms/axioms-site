# Axiomatic Website Plan

This document records the agreed architecture, site boundaries, routing
commitments, and phased sequencing across the Axiomatic web properties.

## Core Strategy: Persuade First, Teach Second

The Axiomatic web presence has two distinct jobs that should not be forced into
the same shell:

1. **Persuade (`axioms.design`)**: Make someone *feel* why designing from
   relationships beats manual tokens and viewport breakpoints within seconds,
   before asking them to read documentation.
2. **Teach & reference (`color.axioms.design`, `layout.axioms.design`)**: Carry
   interested readers into hands-on interactive guides, playgrounds, and
   checked API/specification references.

Alongside the main front page and project guides, we also plan for **guided
interactive essay** secondary pages (visual arguments walking through *why*
manual tokens and breakpoints break, with live inline proofs).

## Properties & Repository Ownership

| Surface | Repository | Vercel project | Role |
| --- | --- | --- | --- |
| `https://axioms.design/` | `design-axioms/axioms-site` | `axioms-site` | Shared front door, live combined Color + Layout showcase, and shared interactive essay(s) |
| `https://layout.axioms.design/` (+ `axiomatic-layout.vercel.app`) | `design-axioms/axiomatic-layout` | `axiomatic-layout` | Interactive Layout guide (`ts-docs` + custom elements) and standalone playground |
| `https://color.axioms.design/` | `design-axioms/axiomatic-color` (v2, planned cutover) | Color v2 deployment | Axiomatic Color v2 guide, interactive demos, and reference |
| `https://www.axioms.design/` (legacy archive) | `design-axioms/color` (v1) | `color-site` | Preserves legacy v1 Color links until deliberately archived/retired |

Local multi-repo workspace layout:

```text
~/Code/Axiomatic/
├── axiomatic.code-workspace
├── site/    (design-axioms/axioms-site)
├── color/   (design-axioms/axiomatic-color)
└── layout/  (design-axioms/axiomatic-layout)
```

## Site-by-Site Plan

### 1. `axioms.design` (`design-axioms/axioms-site`)

- **Bespoke showcase, not `ts-docs`**: Keep `axioms.design` a lightweight,
  purpose-built site rather than a documentation reader shell.
- **Dogfood both systems directly**: Evolve the current static landing page into
  a live showcase styled with `@design-axioms/color` (real surfaces, contrast
  grades, light/dark, atmosphere) and featuring 1–2 live, hands-on specimens
  running Layout's bare primitive runtime so visitors can toggle
  mode/atmosphere, drag width, or edit text and watch relationships hold.
- **Secondary essay page(s)**: Add room for a guided interactive visual essay
  making the shared case for relationship-first color and layout.
- **Self-contained dependency boundary**: Keep `axioms-site` as a separate
  repository that consumes Color and Layout via pinned artifacts/tarballs (or
  published `@design-axioms/color` plus a vendored, provenance-tracked Layout
  primitive runtime snapshot). Clean CI and Vercel checkouts must build
  standalone without sibling directories and without prematurely freezing
  Layout's public library API.
- **Redirect narrowing prerequisite**: `vercel.json` currently redirects
  `/:path(.+)` to `https://www.axioms.design/:path*`. Because Vercel runs
  `redirects` before filesystem lookups, narrow that catch-all to known Color
  v1 prefixes (`/concepts/:path*`, `/guides/:path*`, `/theory/:path*`,
  `/catalog/:path*`, `/advanced/:path*`, `/reference/:path*`, `/why-axiomatic`,
  `/philosophy`, `/alpha-limitations`) before publishing any secondary pages or
  external assets under `public/`.

### 2. `color.axioms.design` & `www.axioms.design`

- **Ship Color v2's existing VitePress site first**: `design-axioms/axiomatic-color`
  already has a VitePress documentation site with 16 interactive Vue widgets
  (`SurfaceTile`, `AtmosphereDropdown`, `PaletteGrid`, `TaperCurve`,
  `ValidityGrid`, etc.) styled with `@design-axioms/color` classes. Cutting
  `color.axioms.design` over to v2's VitePress build gets the v2 system live
  without blocking on a Vue-to-Web-Component rewrite.
- **Preserve legacy v1 links**: Because v1 (`design-axioms/color`) and v2 have
  different route trees, keep v1 archived (on `www.axioms.design` or
  `v1.color.axioms.design`) alongside narrowed apex redirects until we decide
  to retire or map legacy links deliberately.
- **Secondary essay & later `ts-docs` revisit**: Keep a guided interactive
  essay page in view as a secondary surface for Color, and revisit migrating
  Color's docs onto `ts-docs` only *after* `ts-docs` itself adopts Axiomatic
  Color (see Phase 2 below).

### 3. `layout.axioms.design`

- **Stay on `ts-docs` + custom elements**: The `ts-docs` guide and standalone
  workbench (`<axiomatic-example>`, `<axiomatic-playground>`) already work well
  for Layout's hands-on pedagogy and will gain checked TypeScript examples and
  expandable API signatures once Layout's public API emerges.
- **Preserve draft origins**: Keep `axiomatic-layout.vercel.app` serving the
  playground without redirecting to `layout.axioms.design` so existing
  browser-local drafts remain accessible.
- **Secondary essay**: Keep a guided interactive essay in view as a secondary
  page alongside the interactive exercises.

## Sequenced Follow-Up: `ts-docs` Adopting Axiomatic

Do not block the Axiomatic websites on `ts-docs` internals. Instead, run the
work in four phases so each step proves requirements for the next:

1. **Phase 1 — Ship the Axiomatic websites**
   - Spin out `design-axioms/axioms-site` (this repo) and remove `sites/axioms/`
     from `axiomatic-layout`.
   - Evolve `axioms.design` into the live Color + Layout showcase (narrowing
     apex v1 redirects before adding assets/pages).
   - Prepare and cut `color.axioms.design` over to Color v2's VitePress site
     while preserving v1 archival access.
2. **Phase 2 — `@design-axioms/color` in `ts-docs` + upstream seams**
   - Replace `ts-docs` reader's hand-maintained `light-dark()` tokens
     (`reader.css`) with `@design-axioms/color` surfaces, text grades, and
     border tiers—immediately turning every `ts-docs` site (including
     `layout.axioms.design`) into living proof of Axiomatic Color.
   - Upstream the `ts-docs` extension seams documented in
     `axiomatic-layout/documentation/README.md`: guide-only builds without a
     dummy TypeScript entry, first-class custom-element asset registration and
     live-update lifecycle, and base-path-aware asset URLs.
3. **Phase 3 — Revisit Color docs on `ts-docs`**
   - With `ts-docs` powered by Axiomatic Color and supporting custom elements
     cleanly, evaluate migrating Color's docs onto `ts-docs` for a unified
     documentation experience with checked TypeScript examples.
4. **Phase 4 — Axiomatic Layout in `ts-docs`**
   - Once Layout's public library API stabilizes, adopt Axiomatic Layout in the
     `ts-docs` reader (header, navigation rails, declaration cards) as a real
     production consumer.

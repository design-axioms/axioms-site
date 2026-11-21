# Axiomatic home

A buildless landing page for `axioms.design`, linking the Layout guide and
playground at `layout.axioms.design` and the Color site at `color.axioms.design`.
Its CSS follows the existing guide's quiet typography and adapts to the visitor's
light/dark preference. It has no JavaScript, cookies, or storage.

Preview from the repository root:

```sh
python3 -m http.server 8789 --bind 127.0.0.1 --directory sites/axioms
```

Deploy this directory to the dedicated `axioms-site` project in
`yehuda-katzs-projects`, after review and approval. The Layout and Color projects
keep their own deployments. Configure the two subdomains and verify their HTTPS
responses before assigning the apex to this landing page.

Keep the existing `axiomatic-layout.vercel.app` hostname serving the playground:
its browser-local drafts belong to that origin. Readers can copy a snapshot link
there and edit a copy at the new origin to carry a composition across; that does
not transfer Undo history or other drafts. Preserve `www.axioms.design` for the
existing Color site's links until a deliberate redirect migration is prepared.
Non-root requests to the landing project redirect to the same path on that
existing Color hostname, preserving older apex documentation links as well.
The landing page keeps its styles inline so it needs no asset routes of its own.

The original Color domain assignment is `axioms.design` redirecting to
`www.axioms.design`, on project `color-site`. Record any changed assignment and
its rollback in the deployment evidence before changing the apex.

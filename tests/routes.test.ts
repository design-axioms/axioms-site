import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  forwarder,
  legacyOrigin,
  readRedirects,
  redirectProblems,
  type Redirect,
} from "../scripts/routes.ts";

const root = path.resolve(import.meta.dirname, "..");
const redirects = readRedirects(root);
const forward = forwarder(redirects);

test("the rules forward the earlier Color site and nothing of this site's", () => {
  assert.deepEqual(redirectProblems(redirects), []);
});

test("every page the earlier Color site indexed is still forwarded to itself", () => {
  // Recorded from the earlier site during review on 21 November 2026.
  const pages = JSON.parse(
    fs.readFileSync(
      path.join(import.meta.dirname, "legacy-pages.json"),
      "utf8",
    ),
  ) as string[];
  assert.ok(pages.length > 30);
  for (const page of pages) {
    // Each page is a directory index, linked with and without the slash.
    for (const form of [page, page.replace(/\/$/, "")])
      assert.deepEqual(
        forward(form),
        { location: `${legacyOrigin}${form}`, status: 307 },
        form,
      );
  }
});

test("a path that only resembles a forwarded one is served here", () => {
  for (const own of [
    "/",
    "/assets/color.css",
    "/assets/site.js",
    "/conceptsx",
    "/hudson",
    "/studio-notes/",
    "/llms.txt.html",
    "/llmsXtxt",
    "/sitemap-1.xml",
    "/sitemap.xml",
    "/essay/concepts/",
  ])
    assert.equal(forward(own), undefined, own);
});

test("the previous catch-all is reported, because it captures assets", () => {
  const catchAll: Redirect[] = [
    {
      source: "/:path(.+)",
      destination: `${legacyOrigin}/:path*`,
      permanent: false,
    },
  ];
  assert.match(
    redirectProblems(catchAll).join("\n"),
    /\/assets\/site\.js is forwarded/,
  );
});

test("dropping, redirecting elsewhere or making a rule permanent is reported", () => {
  assert.match(
    redirectProblems(redirects.slice(1)).join("\n"),
    /\/concepts\/ is no longer forwarded/,
  );
  const elsewhere = redirects.map((redirect) => ({
    ...redirect,
    destination: "https://color.axioms.design/:path*",
  }));
  assert.match(
    redirectProblems(elsewhere).join("\n"),
    /\/studio is forwarded to https:\/\/color\.axioms\.design\/studio/,
  );
  const permanent = redirects.map((redirect) => ({
    ...redirect,
    permanent: true,
  }));
  assert.match(
    redirectProblems(permanent).join("\n"),
    /\/llms\.txt must stay a temporary redirect/,
  );
});

test("rules Vercel would reject are refused", () => {
  assert.throws(
    () => forwarder([{ source: "/(", destination: "/elsewhere" }]),
    /vercel\.json redirects/,
  );
});

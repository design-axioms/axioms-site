import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function readUtf8(relPath) {
  const fullPath = path.join(root, relPath);
  assert.ok(fs.existsSync(fullPath), `Expected file to exist: ${relPath}`);
  return fs.readFileSync(fullPath, "utf8");
}

function sha256File(relPath) {
  const fullPath = path.join(root, relPath);
  assert.ok(fs.existsSync(fullPath), `Expected vendored file to exist: ${relPath}`);
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(fullPath));
  return hash.digest("hex");
}

// 1. Validate vercel.json build config and narrowed legacy Color v1 redirects.
const vercelConfig = JSON.parse(readUtf8("vercel.json"));
assert.equal(
  vercelConfig.outputDirectory,
  "dist",
  'vercel.json outputDirectory must be "dist" so repo docs are not published',
);
assert.equal(vercelConfig.buildCommand, "pnpm build", 'vercel.json buildCommand must be "pnpm build"');
assert.ok(
  Array.isArray(vercelConfig.redirects) && vercelConfig.redirects.length > 0,
  "vercel.json must retain legacy Color v1 redirect rules",
);

const redirectSources = new Set(vercelConfig.redirects.map((r) => r.source));
assert.ok(
  !redirectSources.has("/:path(.+)"),
  "vercel.json must not keep the blanket /:path(.+) redirect now that bundled assets/pages are served",
);

const requiredLegacySources = [
  "/concepts/:path*",
  "/guides/:path*",
  "/theory/:path*",
  "/catalog/:path*",
  "/advanced/:path*",
  "/reference/:path*",
  "/why-axiomatic",
  "/philosophy",
  "/alpha-limitations",
  "/llms.txt",
  "/llms-full.txt",
];
for (const src of requiredLegacySources) {
  assert.ok(
    redirectSources.has(src),
    `vercel.json is missing legacy Color v1 redirect for ${src}`,
  );
}
for (const rule of vercelConfig.redirects) {
  assert.ok(
    rule.destination.startsWith("https://www.axioms.design/"),
    `Redirect for ${rule.source} must target https://www.axioms.design/`,
  );
  assert.equal(
    rule.permanent,
    false,
    `Redirect for ${rule.source} must remain non-permanent until v1 retirement is finalized`,
  );
}

// 2. Validate vendor/provenance.json checksums.
const provenance = JSON.parse(readUtf8("vendor/provenance.json"));
assert.equal(
  sha256File(provenance.color.file),
  provenance.color.sha256,
  `Checksum mismatch for vendored Color tarball ${provenance.color.file}`,
);
for (const [relPath, entry] of Object.entries(provenance.layout.files)) {
  assert.equal(
    sha256File(relPath),
    entry.sha256,
    `Checksum mismatch for vendored Layout runtime file ${relPath}`,
  );
}

// 3. Validate built output in dist/.
const outputDir = path.join(root, vercelConfig.outputDirectory);
assert.ok(
  fs.existsSync(outputDir) && fs.statSync(outputDir).isDirectory(),
  `Configured outputDirectory does not exist: ${vercelConfig.outputDirectory} (run pnpm build first)`,
);

const indexHtml = readUtf8("dist/index.html");
assert.ok(
  indexHtml.trimStart().toLowerCase().startsWith("<!doctype html>"),
  "dist/index.html must begin with <!doctype html>",
);
assert.match(indexHtml, /<title>[^<]+<\/title>/, "dist/index.html must include a <title>");
assert.ok(
  indexHtml.includes('<link rel="canonical" href="https://axioms.design/" />'),
  "dist/index.html must preserve the canonical https://axioms.design/ link",
);
assert.ok(
  indexHtml.includes("https://layout.axioms.design/"),
  "dist/index.html must link to layout.axioms.design",
);
assert.ok(
  indexHtml.includes("https://color.axioms.design/"),
  "dist/index.html must link to color.axioms.design",
);

// Check local href/src references in built HTML files under dist/.
function collectHtmlFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectHtmlFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      results.push(full);
    }
  }
  return results;
}

for (const htmlFile of collectHtmlFiles(outputDir)) {
  const relHtml = path.relative(root, htmlFile);
  const html = fs.readFileSync(htmlFile, "utf8");
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const target = match[1];
    if (
      target.startsWith("http://") ||
      target.startsWith("https://") ||
      target.startsWith("#") ||
      target.startsWith("mailto:")
    ) {
      continue;
    }
    const cleanTarget = target.split(/[?#]/)[0];
    const resolved = cleanTarget.startsWith("/")
      ? path.join(outputDir, cleanTarget.slice(1))
      : path.resolve(path.dirname(htmlFile), cleanTarget);
    assert.ok(fs.existsSync(resolved), `Broken local asset/link "${target}" in ${relHtml}`);
  }
}

// 4. Validate required repository docs and their local Markdown links.
const requiredDocs = ["README.md", "CONTRIBUTING.md", "docs/WEBSITE-PLAN.md"];
for (const docPath of requiredDocs) {
  const content = readUtf8(docPath);
  const docDir = path.dirname(path.join(root, docPath));
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const rawTarget = match[1].trim();
    if (
      rawTarget.startsWith("http://") ||
      rawTarget.startsWith("https://") ||
      rawTarget.startsWith("#") ||
      rawTarget.startsWith("mailto:")
    ) {
      continue;
    }
    const targetPath = rawTarget.split("#")[0];
    if (!targetPath) continue;
    const resolved = path.resolve(docDir, targetPath);
    assert.ok(
      fs.existsSync(resolved),
      `Broken local Markdown link "${rawTarget}" in ${docPath}`,
    );
  }
}

console.log("axioms-site validation passed.");

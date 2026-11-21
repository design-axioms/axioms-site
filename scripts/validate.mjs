import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function readUtf8(relPath) {
  const fullPath = path.join(root, relPath);
  assert.ok(fs.existsSync(fullPath), `Expected file to exist: ${relPath}`);
  return fs.readFileSync(fullPath, "utf8");
}

// 1. Validate vercel.json and its outputDirectory.
const vercelConfig = JSON.parse(readUtf8("vercel.json"));
assert.equal(
  vercelConfig.outputDirectory,
  "public",
  'vercel.json outputDirectory must be "public" so repo docs are not published',
);
assert.ok(
  Array.isArray(vercelConfig.redirects) && vercelConfig.redirects.length > 0,
  "vercel.json must retain legacy Color redirect rules",
);
const outputDir = path.join(root, vercelConfig.outputDirectory);
assert.ok(
  fs.existsSync(outputDir) && fs.statSync(outputDir).isDirectory(),
  `Configured outputDirectory does not exist: ${vercelConfig.outputDirectory}`,
);

// 2. Validate public/index.html essentials.
const indexHtml = readUtf8("public/index.html");
assert.ok(
  indexHtml.trimStart().toLowerCase().startsWith("<!doctype html>"),
  "public/index.html must begin with <!doctype html>",
);
assert.match(indexHtml, /<title>[^<]+<\/title>/, "public/index.html must include a <title>");
assert.ok(
  indexHtml.includes('<link rel="canonical" href="https://axioms.design/" />'),
  "public/index.html must preserve the canonical https://axioms.design/ link",
);
assert.ok(
  indexHtml.includes("https://layout.axioms.design/"),
  "public/index.html must link to layout.axioms.design",
);
assert.ok(
  indexHtml.includes("https://color.axioms.design/"),
  "public/index.html must link to color.axioms.design",
);

// Check local href/src references in HTML files under public/.
for (const entry of fs.readdirSync(outputDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
  const html = readUtf8(path.join(vercelConfig.outputDirectory, entry.name));
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
      : path.join(outputDir, cleanTarget);
    assert.ok(
      fs.existsSync(resolved),
      `Broken local asset/link "${target}" in ${vercelConfig.outputDirectory}/${entry.name}`,
    );
  }
}

// 3. Validate required repository docs and their local Markdown links.
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

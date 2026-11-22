import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const colorRepo = path.resolve(root, "..", "color");
const layoutRepo = path.resolve(root, "..", "layout");
const vendorDir = path.join(root, "vendor");
const layoutVendorDir = path.join(vendorDir, "axiomatic-layout");

const LAYOUT_FILES = [
  "composition.ts",
  "primitives.ts",
  "primitives.css",
  "switcher-coordinator.ts",
  "authored-elements.ts",
  "authored-elements.css",
];

function git(repo, args) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

ensureDir(vendorDir);
ensureDir(layoutVendorDir);

// 1. Pack @design-axioms/color from sibling ../color/packages/core.
const colorCoreDir = path.join(colorRepo, "packages", "core");
if (!fs.existsSync(path.join(colorCoreDir, "dist", "index.js"))) {
  throw new Error(
    `Missing built @design-axioms/color dist at ${colorCoreDir}/dist — run \`pnpm build\` in ../color first.`,
  );
}

for (const existing of fs.readdirSync(vendorDir)) {
  if (existing.startsWith("design-axioms-color-") && existing.endsWith(".tgz")) {
    fs.rmSync(path.join(vendorDir, existing));
  }
}

execFileSync("pnpm", ["pack", "--pack-destination", vendorDir], {
  cwd: colorCoreDir,
  stdio: "inherit",
});

const colorTarballs = fs
  .readdirSync(vendorDir)
  .filter((name) => name.startsWith("design-axioms-color-") && name.endsWith(".tgz"));
if (colorTarballs.length !== 1) {
  throw new Error(`Expected exactly 1 packed color tarball, found: ${colorTarballs.join(", ")}`);
}
const colorTarballName = colorTarballs[0];
const colorTarballRel = `vendor/${colorTarballName}`;
const colorTarballPath = path.join(root, colorTarballRel);

// 2. Copy Layout bare primitive runtime + authored-elements adapter from sibling ../layout.
const layoutSourceDir = path.join(layoutRepo, "documentation", "components", "source");
const layoutEntries = {};
for (const fileName of LAYOUT_FILES) {
  const srcPath = path.join(layoutSourceDir, fileName);
  const dstRel = `vendor/axiomatic-layout/${fileName}`;
  const dstPath = path.join(root, dstRel);
  fs.copyFileSync(srcPath, dstPath);
  layoutEntries[dstRel] = {
    sourcePath: `documentation/components/source/${fileName}`,
    sha256: sha256File(dstPath),
  };
}

// 3. Write vendor/provenance.json.
const provenance = {
  color: {
    repository: "https://github.com/design-axioms/axiomatic-color",
    commit: git(colorRepo, ["rev-parse", "HEAD"]),
    dirty: git(colorRepo, ["status", "--porcelain"]).length > 0,
    package: "@design-axioms/color",
    file: colorTarballRel,
    sha256: sha256File(colorTarballPath),
  },
  layout: {
    repository: "https://github.com/design-axioms/axiomatic-layout",
    commit: git(layoutRepo, ["rev-parse", "HEAD"]),
    dirty: git(layoutRepo, ["status", "--porcelain"]).length > 0,
    files: layoutEntries,
  },
};

fs.writeFileSync(
  path.join(vendorDir, "provenance.json"),
  `${JSON.stringify(provenance, null, 2)}\n`,
);

console.log(`Synced vendor snapshots:\n- ${colorTarballRel}\n- ${LAYOUT_FILES.length} layout runtime files`);

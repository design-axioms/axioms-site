/**
 * Keeps the two upstream dependencies this site builds from.
 *
 * Neither is published, so the repository carries them: Axiomatic Layout as
 * a verbatim snapshot of four source files, Axiomatic Color as the package
 * tarball built from its source. Each directory under `vendor/` has a
 * `provenance.json` naming the exact upstream revision and a SHA-256 for
 * every file, so a clean checkout builds with no sibling directory and a
 * reviewer can tell what the site is running.
 *
 *   node scripts/vendor.ts check
 *   node scripts/vendor.ts layout <layout checkout> <revision>
 *   node scripts/vendor.ts color <color checkout> <revision>
 *
 * `check` needs nothing but this repository. The other two read a named
 * revision out of a local clone with git, never its working tree.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const layoutDirectory = path.join(root, "vendor/axiomatic-layout");
const colorDirectory = path.join(root, "vendor/design-axioms-color");

/** The Layout files the specimen needs, and where they live upstream. */
const layoutSource = "documentation/components/source";
const layoutFiles = [
  "authored-elements.ts",
  "authored-elements.css",
  "primitives.css",
  "switcher-coordinator.ts",
];
const colorPackage = "packages/core";

export interface VendoredFile {
  /** Path in the upstream repository, or inside the package tarball. */
  readonly path: string;
  readonly sha256: string;
}
export interface Provenance {
  readonly name: string;
  readonly repository: string;
  /** The full upstream commit the files were read from. */
  readonly revision: string;
  readonly license: string;
  readonly files: readonly VendoredFile[];
  /** Present for a built artifact. */
  readonly artifact?: {
    readonly file: string;
    readonly sha256: string;
    readonly package: string;
    readonly version: string;
    readonly builtWith: Record<string, string>;
  };
}

const sha256 = (data: Buffer | string) =>
  createHash("sha256").update(data).digest("hex");

function git(repository: string, ...args: string[]): Buffer {
  return execFileSync("git", ["-C", repository, ...args], {
    maxBuffer: 256 * 1024 * 1024,
  });
}

/** Refuses an abbreviated or symbolic revision: provenance names a commit. */
function commit(repository: string, revision: string): string {
  const full = git(repository, "rev-parse", "--verify", `${revision}^{commit}`)
    .toString()
    .trim();
  if (full !== revision)
    throw new Error(
      `Give the full commit: ${revision} resolves to ${full} in ${repository}`,
    );
  return full;
}

function readProvenance(directory: string): Provenance {
  return JSON.parse(
    fs.readFileSync(path.join(directory, "provenance.json"), "utf8"),
  ) as Provenance;
}

function writeProvenance(directory: string, provenance: Provenance) {
  fs.writeFileSync(
    path.join(directory, "provenance.json"),
    `${JSON.stringify(provenance, null, 2)}\n`,
  );
}

/** Unpacks a package tarball and returns the hash of each file inside. */
function tarballFiles(tarball: string): VendoredFile[] {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "axioms-vendor-"));
  try {
    execFileSync("tar", ["-xzf", tarball, "-C", scratch]);
    const found: VendoredFile[] = [];
    const walk = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(full);
        else
          found.push({
            path: path.relative(scratch, full).split(path.sep).join("/"),
            sha256: sha256(fs.readFileSync(full)),
          });
      }
    };
    walk(scratch);
    return found.sort((a, b) => (a.path < b.path ? -1 : 1));
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

/** Every difference between a `vendor/` directory and its provenance
 * records. The default is this repository's. */
export function vendorProblems(
  vendor: string = path.join(root, "vendor"),
): string[] {
  const problems: string[] = [];
  const layoutDirectory = path.join(vendor, "axiomatic-layout");
  const colorDirectory = path.join(vendor, "design-axioms-color");

  const layout = readProvenance(layoutDirectory);
  const expected = new Set(["provenance.json"]);
  for (const file of layout.files) {
    const name = path.basename(file.path);
    expected.add(name);
    const local = path.join(layoutDirectory, name);
    if (!fs.existsSync(local)) problems.push(`Layout: ${name} is missing`);
    else if (sha256(fs.readFileSync(local)) !== file.sha256)
      problems.push(
        `Layout: ${name} differs from ${layout.revision}. Change it upstream and vendor again`,
      );
  }
  for (const name of fs.readdirSync(layoutDirectory))
    if (!expected.has(name))
      problems.push(`Layout: ${name} has no provenance record`);

  const color = readProvenance(colorDirectory);
  if (!color.artifact) problems.push("Color: no artifact is recorded");
  else {
    const tarball = path.join(colorDirectory, color.artifact.file);
    if (!fs.existsSync(tarball))
      problems.push(`Color: ${color.artifact.file} is missing`);
    else {
      if (sha256(fs.readFileSync(tarball)) !== color.artifact.sha256)
        problems.push(`Color: ${color.artifact.file} differs from its record`);
      else if (
        JSON.stringify(tarballFiles(tarball)) !== JSON.stringify(color.files)
      )
        problems.push(`Color: the tarball's contents differ from its record`);
    }
    for (const name of fs.readdirSync(colorDirectory))
      if (name !== "provenance.json" && name !== color.artifact.file)
        problems.push(`Color: ${name} has no provenance record`);
  }
  return problems;
}

function vendorLayout(repository: string, revision: string) {
  const full = commit(repository, revision);
  const files = layoutFiles.map((name) => {
    const upstream = `${layoutSource}/${name}`;
    const contents = git(repository, "show", `${full}:${upstream}`);
    fs.writeFileSync(path.join(layoutDirectory, name), contents);
    return { path: upstream, sha256: sha256(contents) };
  });
  writeProvenance(layoutDirectory, {
    ...readProvenance(layoutDirectory),
    revision: full,
    files,
  });
}

/**
 * Builds the package the way its own repository does: a clean export of the
 * revision, its locked dependencies, its build script, then `pnpm pack`.
 */
function vendorColor(repository: string, revision: string) {
  const full = commit(repository, revision);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "axioms-color-"));
  try {
    const archive = path.join(scratch, "source.tar");
    fs.writeFileSync(archive, git(repository, "archive", "--format=tar", full));
    const source = path.join(scratch, "source");
    fs.mkdirSync(source);
    execFileSync("tar", ["-xf", archive, "-C", source]);

    const run = (cwd: string, ...args: string[]) =>
      execFileSync("pnpm", args, {
        cwd,
        stdio: ["ignore", "inherit", "inherit"],
      });
    const core = path.join(source, colorPackage);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(core, "package.json"), "utf8"),
    ) as { name: string; version: string; license: string };
    // A clean export is not a git repository, which the workspace's own
    // `prepare` hook installer requires. No install script is needed to
    // compile the package.
    run(
      source,
      "install",
      "--frozen-lockfile",
      "--ignore-scripts",
      "--filter",
      `${manifest.name}...`,
    );
    run(source, "--filter", manifest.name, "build");

    const previous = readProvenance(colorDirectory);
    run(core, "pack", "--pack-destination", scratch);
    const file = fs.readdirSync(scratch).find((name) => name.endsWith(".tgz"));
    if (!file) throw new Error("pnpm pack produced no tarball");
    const tarball = path.join(scratch, file);

    const version = (cwd: string, ...args: string[]) =>
      execFileSync("pnpm", args, { cwd }).toString().trim();
    const next: Provenance = {
      ...previous,
      revision: full,
      license: manifest.license,
      files: tarballFiles(tarball),
      artifact: {
        file,
        sha256: sha256(fs.readFileSync(tarball)),
        package: manifest.name,
        version: manifest.version,
        builtWith: {
          node: process.version,
          pnpm: version(source, "--version"),
          typescript: version(core, "exec", "tsc", "--version"),
        },
      },
    };
    fs.copyFileSync(tarball, path.join(colorDirectory, file));
    writeProvenance(colorDirectory, next);
    if (previous.artifact && previous.artifact.file !== file)
      fs.rmSync(path.join(colorDirectory, previous.artifact.file), {
        force: true,
      });
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const [command = "check", repository, revision] = process.argv.slice(2);
  if (command === "check") {
    const problems = vendorProblems();
    for (const problem of problems) console.error(problem);
    if (problems.length > 0) process.exit(1);
    console.log("vendor/ matches its provenance records.");
  } else if (
    (command === "layout" || command === "color") &&
    repository &&
    revision
  ) {
    (command === "layout" ? vendorLayout : vendorColor)(
      path.resolve(repository),
      revision,
    );
    console.log(`Vendored ${command} at ${revision}.`);
  } else {
    console.error(
      "Usage: node scripts/vendor.ts check | layout <checkout> <revision> | color <checkout> <revision>",
    );
    process.exit(2);
  }
}

/**
 * Keeps the two upstream dependencies this site builds from.
 *
 * This repository carries installable archives of Axiomatic Layout and
 * Axiomatic Color. Each provenance record names its source commit and the
 * SHA-256 of the archive and each file inside.
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
const packages = {
  layout: {
    label: "Layout",
    directory: "axiomatic-layout",
    source: "packages/layout",
  },
  color: {
    label: "Color",
    directory: "design-axioms-color",
    source: "packages/core",
  },
};

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
  for (const { label, directory } of Object.values(packages)) {
    const location = path.join(vendor, directory);
    const record = readProvenance(location);
    if (!record.artifact) {
      problems.push(`${label}: no artifact is recorded`);
      continue;
    }
    const { file, sha256: digest } = record.artifact;
    const archive = path.join(location, file);
    if (!fs.existsSync(archive)) problems.push(`${label}: ${file} is missing`);
    else if (sha256(fs.readFileSync(archive)) !== digest)
      problems.push(`${label}: ${file} differs from its record`);
    else if (
      JSON.stringify(tarballFiles(archive)) !== JSON.stringify(record.files)
    )
      problems.push(`${label}: the tarball's contents differ from its record`);
    for (const name of fs.readdirSync(location))
      if (name !== "provenance.json" && name !== file)
        problems.push(`${label}: ${name} has no provenance record`);
  }
  return problems;
}

/**
 * Builds the package the way its own repository does: a clean export of the
 * revision, its locked dependencies, its build script, then `pnpm pack`.
 */
function vendorPackage(
  name: keyof typeof packages,
  repository: string,
  revision: string,
) {
  const directory = path.join(root, "vendor", packages[name].directory);
  const full = commit(repository, revision);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), `axioms-${name}-`));
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
    const packageRoot = path.join(source, packages[name].source);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"),
    ) as { name: string; version: string; license?: string };
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

    const previous = readProvenance(directory);
    run(packageRoot, "pack", "--pack-destination", scratch);
    const file = fs.readdirSync(scratch).find((name) => name.endsWith(".tgz"));
    if (!file) throw new Error("pnpm pack produced no tarball");
    const tarball = path.join(scratch, file);

    const version = (cwd: string, ...args: string[]) =>
      execFileSync("pnpm", args, { cwd }).toString().trim();
    const next: Provenance = {
      ...previous,
      revision: full,
      license: manifest.license ?? previous.license,
      files: tarballFiles(tarball),
      artifact: {
        file,
        sha256: sha256(fs.readFileSync(tarball)),
        package: manifest.name,
        version: manifest.version,
        builtWith: {
          node: process.version,
          pnpm: version(source, "--version"),
          typescript: version(packageRoot, "exec", "tsc", "--version"),
        },
      },
    };
    fs.copyFileSync(tarball, path.join(directory, file));
    writeProvenance(directory, next);
    if (previous.artifact && previous.artifact.file !== file)
      fs.rmSync(path.join(directory, previous.artifact.file), {
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
    vendorPackage(command, path.resolve(repository), revision);
    console.log(`Vendored ${command} at ${revision}.`);
  } else {
    console.error(
      "Usage: node scripts/vendor.ts check | layout <checkout> <revision> | color <checkout> <revision>",
    );
    process.exit(2);
  }
}

/**
 * Checks the built site and the repository around it.
 *
 *   node scripts/build.ts && node scripts/validate.ts
 *
 * Each check guards something a passing build would not show:
 *
 * - the vendored Layout and Color files are the recorded upstream revisions;
 * - every dependency is inside this repository, so a clean checkout builds;
 * - the redirect rules forward the earlier Color site's paths and nothing
 *   this site serves;
 * - the pages keep their canonical address and their links to both guides,
 *   the playground and the Color archive;
 * - every local link, fragment and element reference resolves;
 * - color-related classes on the page occur in a published stylesheet. A
 *   misspelled class sets no color, and nothing else would report it.
 */
import fs from "node:fs";
import path from "node:path";
import { forwarder, readRedirects, redirectProblems } from "./routes.ts";
import { vendorProblems } from "./vendor.ts";

const root = path.resolve(import.meta.dirname, "..");
const problems: string[] = [];

function read(relative: string): string {
  return fs.readFileSync(path.join(root, relative), "utf8");
}
function filesUnder(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));
}
/** Every value of the named attributes in a document. */
function attributes(html: string, ...names: string[]): string[] {
  const pattern = new RegExp(`\\s(?:${names.join("|")})="([^"]*)"`, "g");
  return Array.from(html.matchAll(pattern), (match) => match[1]!);
}

// Vendored sources.
problems.push(...vendorProblems());

// Dependencies stay inside the repository.
const manifest = JSON.parse(read("package.json")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
for (const [name, version] of Object.entries({
  ...manifest.dependencies,
  ...manifest.devDependencies,
})) {
  const local = /^(?:file|link):(.*)$/.exec(version)?.[1];
  if (local === undefined) continue;
  const resolved = path.resolve(root, local);
  if (!resolved.startsWith(root + path.sep) || !fs.existsSync(resolved))
    problems.push(`${name} depends on ${local}, outside this repository`);
}

// Routing.
const config = JSON.parse(read("vercel.json")) as { outputDirectory?: string };
const redirects = readRedirects(root);
problems.push(...redirectProblems(redirects));
const forward = forwarder(redirects);

const output = path.join(root, config.outputDirectory ?? "");
if (config.outputDirectory !== "dist")
  problems.push('vercel.json must publish "dist", the build output');
else if (!fs.existsSync(path.join(output, "index.html")))
  problems.push("dist/index.html is missing. Run the build first");
else {
  const built = filesUnder(output);
  const served = (file: string) =>
    `/${path.relative(output, file).split(path.sep).join("/")}`;

  for (const file of built) {
    const forwarded = forward(served(file));
    if (forwarded)
      problems.push(
        `${served(file)} would be forwarded to ${forwarded.location}`,
      );
    // A bundle that names this checkout would not build anywhere else.
    if (fs.readFileSync(file).includes(root))
      problems.push(`${served(file)} contains this checkout's absolute path`);
  }

  const styles =
    read("dist/assets/color.css") + "\n" + read("dist/assets/site.css");
  const colorClasses = new Set(
    Array.from(
      styles.matchAll(/\.((?:surface|hue|text|border)-[\w-]+)/g),
      (match) => match[1]!,
    ),
  );

  for (const file of built.filter((file) => file.endsWith(".html"))) {
    const page = served(file);
    const html = fs.readFileSync(file, "utf8");
    const ids = new Set(attributes(html, "id"));

    for (const target of attributes(html, "href", "src")) {
      if (/^(?:https?:|mailto:)/.test(target)) continue;
      const [local = "", fragment] = target.split("#");
      if (local !== "") {
        const address = new URL(local, `https://axioms.design${page}`).pathname;
        const resolved = path.join(
          output,
          address.endsWith("/") ? `${address}index.html` : address,
        );
        if (forward(address))
          problems.push(`${page}: ${target} would be forwarded elsewhere`);
        else if (!fs.existsSync(resolved))
          problems.push(`${page}: ${target} is not in the build`);
      } else if (fragment && !ids.has(fragment))
        problems.push(`${page}: no element has id "${fragment}"`);
    }
    for (const reference of attributes(
      html,
      "for",
      "aria-labelledby",
      "aria-describedby",
      "aria-controls",
    ).flatMap((value) => value.split(/\s+/)))
      if (reference && !ids.has(reference))
        problems.push(`${page}: no element has id "${reference}"`);

    for (const name of attributes(html, "class").flatMap((value) =>
      value.split(/\s+/),
    ))
      if (/^(?:surface|hue|text|border)-/.test(name) && !colorClasses.has(name))
        problems.push(`${page}: The stylesheets have no .${name}`);
  }

  const home = read("dist/index.html");
  if (!home.trimStart().toLowerCase().startsWith("<!doctype html>"))
    problems.push("The home page must begin with <!doctype html>");
  if (!/<title>[^<]+<\/title>/.test(home))
    problems.push("The home page needs a <title>");
  for (const [what, text] of [
    [
      "its canonical address",
      '<link rel="canonical" href="https://axioms.design/" />',
    ],
    [
      "the Layout guide",
      "https://layout.axioms.design/getting-started/index.html",
    ],
    [
      "the Layout playground",
      "https://layout.axioms.design/_media/documentation/playground/index.html",
    ],
    ["the Color guide", "https://color.axioms.design/"],
    ["the Color archive", "https://www.axioms.design/"],
  ] as const)
    if (!home.includes(text))
      problems.push(`The home page lost ${what}: ${text}`);
}

// Repository documents and their local links.
for (const document of [
  "README.md",
  "CONTRIBUTING.md",
  "docs/WEBSITE-PLAN.md",
  "vendor/README.md",
]) {
  if (!fs.existsSync(path.join(root, document))) {
    problems.push(`${document} is missing`);
    continue;
  }
  for (const [, target = ""] of read(document).matchAll(
    /\[[^\]]+\]\(([^)]+)\)/g,
  )) {
    const local = target.trim().split("#")[0]!;
    if (local === "" || /^(?:https?:|mailto:)/.test(local)) continue;
    if (!fs.existsSync(path.resolve(root, path.dirname(document), local)))
      problems.push(`${document}: broken link ${target}`);
  }
}

for (const problem of problems) console.error(problem);
if (problems.length > 0) process.exit(1);
console.log("axioms-site validation passed.");

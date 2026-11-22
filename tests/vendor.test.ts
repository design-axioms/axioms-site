import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { vendorProblems, type Provenance } from "../scripts/vendor.ts";

const vendor = path.resolve(import.meta.dirname, "../vendor");

/** Runs `change` on a copy of `vendor/` and returns what the check finds. */
function after(change: (copy: string) => void): string[] {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), "axioms-vendor-test-"));
  try {
    fs.cpSync(vendor, copy, { recursive: true });
    change(copy);
    return vendorProblems(copy);
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
  }
}

test("the vendored files are the recorded upstream revisions", () => {
  assert.deepEqual(vendorProblems(), []);
  for (const name of ["axiomatic-layout", "design-axioms-color"]) {
    const provenance = JSON.parse(
      fs.readFileSync(path.join(vendor, name, "provenance.json"), "utf8"),
    ) as Provenance;
    assert.match(provenance.revision, /^[0-9a-f]{40}$/, name);
    assert.match(
      provenance.repository,
      /^https:\/\/github\.com\/design-axioms\//,
    );
    assert.ok(provenance.files.length > 0, name);
  }
});

test("a local edit to a vendored Layout file is reported", () => {
  const problems = after((copy) =>
    fs.appendFileSync(
      path.join(copy, "axiomatic-layout/primitives.css"),
      "\n/* local fix */\n",
    ),
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /primitives\.css differs from [0-9a-f]{40}/);
});

test("a missing or unrecorded vendored file is reported", () => {
  assert.match(
    after((copy) =>
      fs.rmSync(path.join(copy, "axiomatic-layout/switcher-coordinator.ts")),
    ).join("\n"),
    /switcher-coordinator\.ts is missing/,
  );
  assert.match(
    after((copy) =>
      fs.writeFileSync(path.join(copy, "axiomatic-layout/extra.ts"), ""),
    ).join("\n"),
    /extra\.ts has no provenance record/,
  );
});

test("a different Color tarball is reported", () => {
  const problems = after((copy) => {
    const directory = path.join(copy, "design-axioms-color");
    const tarball = fs
      .readdirSync(directory)
      .find((name) => name.endsWith(".tgz"))!;
    fs.writeFileSync(path.join(directory, tarball), "damaged package");
  });
  assert.match(problems.join("\n"), /\.tgz differs from its record/);
});

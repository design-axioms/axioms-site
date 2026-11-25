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

function archive(directory: string) {
  const { artifact } = JSON.parse(
    fs.readFileSync(path.join(directory, "provenance.json"), "utf8"),
  ) as Provenance;
  assert.ok(artifact);
  return path.join(directory, artifact.file);
}

for (const name of ["axiomatic-layout", "design-axioms-color"]) {
  test(`a different ${name} tarball is reported`, () => {
    const problems = after((copy) =>
      fs.appendFileSync(archive(path.join(copy, name)), "damaged package"),
    );
    assert.equal(problems.length, 1);
    assert.match(problems[0]!, /\.tgz differs from its record/);
  });
}

test("a missing or unrecorded vendored file is reported", () => {
  assert.match(
    after((copy) =>
      fs.rmSync(archive(path.join(copy, "axiomatic-layout"))),
    ).join("\n"),
    /\.tgz is missing/,
  );
  assert.match(
    after((copy) =>
      fs.writeFileSync(path.join(copy, "axiomatic-layout/extra.ts"), ""),
    ).join("\n"),
    /extra\.ts has no provenance record/,
  );
});

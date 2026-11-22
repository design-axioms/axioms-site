import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { createPreview, fileFor } from "../scripts/serve.ts";

const root = path.resolve(import.meta.dirname, "..");

function site() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "axioms-serve-"));
  fs.mkdirSync(path.join(directory, "assets"));
  fs.mkdirSync(path.join(directory, "concepts"));
  fs.writeFileSync(path.join(directory, "index.html"), "<!doctype html>home");
  fs.writeFileSync(path.join(directory, "assets/site.css"), "body{}");
  fs.writeFileSync(path.join(directory, "concepts/index.html"), "shadowed");
  return directory;
}

test("a request path names a file inside the site, or nothing", () => {
  const directory = site();
  try {
    const name = (pathname: string) => {
      const file = fileFor(directory, pathname);
      return file && path.relative(directory, file);
    };
    assert.equal(name("/"), "index.html");
    assert.equal(name("/index.html"), "index.html");
    assert.equal(name("/assets/site.css"), path.join("assets", "site.css"));
    assert.equal(name("/assets"), undefined, "a directory is not a file");
    assert.equal(name("/missing.css"), undefined);
    assert.equal(name("/%2e%2e/%2e%2e/etc/hosts"), undefined);
    assert.equal(name("/%"), undefined, "malformed encoding");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("the preview answers redirects before files, as production does", async () => {
  const directory = site();
  const server = createPreview(directory, root);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const get = (pathname: string) =>
    fetch(`http://127.0.0.1:${port}${pathname}`, { redirect: "manual" });
  try {
    const home = await get("/");
    assert.equal(home.status, 200);
    assert.match(home.headers.get("content-type")!, /^text\/html/);
    assert.equal(await home.text(), "<!doctype html>home");

    const asset = await get("/assets/site.css?v=1");
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("content-type")!, /^text\/css/);
    await asset.body?.cancel();

    // A file exists at this path, and the rule still wins.
    const legacy = await get("/concepts/?mode=dark&example=one%20two");
    assert.equal(legacy.status, 307);
    assert.equal(
      legacy.headers.get("location"),
      "https://www.axioms.design/concepts/?mode=dark&example=one%20two",
    );

    assert.equal((await get("/nothing-here")).status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

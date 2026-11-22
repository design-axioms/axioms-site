import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { legacyFiles, legacyOrigin } from "../scripts/routes.ts";

const pages: string[] = JSON.parse(
  readFileSync(new URL("../tests/legacy-pages.json", import.meta.url), "utf8"),
);

for (const page of pages) {
  test(`the archive keeps ${page} and its directory-index forms`, async ({
    request,
  }) => {
    for (const pathname of [page, page.slice(0, -1), `${page}index.html`]) {
      const response = await request.get(pathname, { maxRedirects: 0 });
      expect(response.status(), pathname).toBe(307);
      expect(response.headers().location, pathname).toBe(
        legacyOrigin + pathname,
      );
    }
  });
}

test("the archive keeps its indexes and forwarded query strings", async ({
  request,
}) => {
  for (const pathname of [
    ...legacyFiles.map((file) => "/" + file),
    "/guides/quick-start/?theme=violet&example=one%20two",
  ]) {
    const response = await request.get(pathname, { maxRedirects: 0 });
    expect(response.status(), pathname).toBe(307);
    expect(response.headers().location, pathname).toBe(legacyOrigin + pathname);
  }
});

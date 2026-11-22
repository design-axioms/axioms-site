/**
 * Previews the built site at http://127.0.0.1:8789/, rebuilding on change.
 *
 *   node scripts/serve.ts [--port 8789] [--once]
 *
 * Requests are answered in Vercel's order: a redirect rule in `vercel.json`
 * first, then a file in `dist/`. A forwarded path therefore answers with
 * the same 307 here as in production, and an asset that a rule would
 * capture fails here too. `--once` builds a single time and does not watch.
 *
 * While a source file has an error, the bundler withholds `site.js` and
 * `site.css` and prints the error here; they return when the error is fixed.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { buildSite, outputDirectory, watchSite } from "./build.ts";
import { forwarder, readRedirects } from "./routes.ts";

const root = path.resolve(import.meta.dirname, "..");

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

/** The file in `directory` a request path names, if there is one. */
export function fileFor(
  directory: string,
  pathname: string,
): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  const requested = path.join(directory, path.normalize(decoded));
  if (requested !== directory && !requested.startsWith(directory + path.sep))
    return undefined;
  const candidates = decoded.endsWith("/")
    ? [path.join(requested, "index.html")]
    : [requested];
  return candidates.find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
  );
}

export function createPreview(directory: string, redirectRoot: string) {
  return http.createServer((request, response) => {
    const { pathname, search } = new URL(
      request.url ?? "/",
      "http://preview.invalid",
    );
    // Read on each request, so an edited rule applies without a restart.
    const forwarded = forwarder(readRedirects(redirectRoot))(pathname);
    if (forwarded) {
      response.writeHead(forwarded.status, {
        Location: forwarded.location + search,
      });
      response.end();
      return;
    }
    const file = fileFor(directory, pathname);
    if (!file) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found\n");
      return;
    }
    response.writeHead(200, {
      "Content-Type":
        contentTypes[path.extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(file).pipe(response);
  });
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--port");
  const port = at === -1 ? 8789 : Number(args[at + 1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("Usage: node scripts/serve.ts [--port 8789] [--once]");
    process.exit(2);
  }
  if (args.includes("--once")) await buildSite();
  else await watchSite();
  createPreview(outputDirectory, root).listen(port, "127.0.0.1", () => {
    console.log(`Previewing dist/ at http://127.0.0.1:${port}/`);
  });
}

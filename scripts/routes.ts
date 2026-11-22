/**
 * The apex's redirects to the earlier Color documentation.
 *
 * `axioms.design` used to forward every path to `www.axioms.design`, where
 * the first Color site still lives. Vercel applies redirects before it looks
 * for a file, so that rule would also have forwarded this site's own assets.
 * The rules in `vercel.json` now name the earlier site's paths one family at
 * a time, and every other path belongs to this site.
 *
 * Rules are compiled with Vercel's own `@vercel/routing-utils`, the package
 * its CLI uses, so what this module says a path does is what the rules mean
 * to Vercel. The local preview server and the checks both ask here.
 */
import fs from "node:fs";
import path from "node:path";
import { getTransformedRoutes } from "@vercel/routing-utils";

export interface Redirect {
  readonly source: string;
  readonly destination: string;
  readonly permanent?: boolean;
}

/** Where the earlier Color site is served. */
export const legacyOrigin = "https://www.axioms.design";

/**
 * Paths the earlier Color site serves, which the apex keeps forwarding. Its
 * links and its sitemap name the apex, so these are live URLs.
 *
 * A family covers the bare path, its trailing-slash form and everything
 * below it: the earlier site publishes each page as a directory index.
 */
export const legacyFamilies = [
  "concepts",
  "guides",
  "theory",
  "catalog",
  "advanced",
  "reference",
  "studio",
  "hud",
  "why-axiomatic",
  "philosophy",
  "alpha-limitations",
] as const;
/** Single files at the earlier site's root. */
export const legacyFiles = [
  "llms.txt",
  "llms-full.txt",
  "sitemap-index.xml",
  "sitemap-0.xml",
] as const;

export function readRedirects(root: string): Redirect[] {
  const config = JSON.parse(
    fs.readFileSync(path.join(root, "vercel.json"), "utf8"),
  ) as { redirects?: Redirect[] };
  return config.redirects ?? [];
}

export interface Forwarding {
  readonly location: string;
  readonly status: number;
}

/**
 * Compiles redirect rules as Vercel does, and returns a function that says
 * where a request path is forwarded, or `undefined` if this site serves it.
 * Throws if Vercel would reject the rules.
 */
export function forwarder(
  redirects: readonly Redirect[],
): (pathname: string) => Forwarding | undefined {
  const { routes, error } = getTransformedRoutes({
    redirects: redirects.map((redirect) => ({ ...redirect })),
  });
  if (error) throw new Error(`vercel.json redirects: ${error.message}`);
  const compiled = (routes ?? []).flatMap((route) => {
    // A redirect compiles to a matching route that answers with a Location.
    if ("handle" in route) return [];
    const location = route.headers?.["Location"];
    if (!location || !route.status) return [];
    return [{ pattern: new RegExp(route.src), location, status: route.status }];
  });
  return (pathname) => {
    for (const { pattern, location, status } of compiled) {
      const match = pattern.exec(pathname);
      if (match)
        return {
          location: location.replace(
            /\$(\d+)/g,
            (_: string, index: string) => match[Number(index)] ?? "",
          ),
          status,
        };
    }
    return undefined;
  };
}

/** What is wrong with the rules as a set, without reference to any file. */
export function redirectProblems(redirects: readonly Redirect[]): string[] {
  const problems: string[] = [];
  const forward = forwarder(redirects);

  // A catch-all would forward this site's own pages and assets.
  for (const own of ["/", "/index.html", "/assets/site.js", "/essay/"]) {
    const forwarded = forward(own);
    if (forwarded)
      problems.push(`${own} is forwarded to ${forwarded.location}`);
  }

  // Temporary (307) until the earlier site is deliberately retired or mapped.
  const expectForwarded = (pathname: string) => {
    const forwarded = forward(pathname);
    const wanted = `${legacyOrigin}${pathname}`;
    if (!forwarded) problems.push(`${pathname} is no longer forwarded`);
    else if (forwarded.location !== wanted)
      problems.push(`${pathname} is forwarded to ${forwarded.location}`);
    else if (forwarded.status !== 307)
      problems.push(`${pathname} must stay a temporary redirect`);
  };
  for (const family of legacyFamilies)
    for (const rest of ["", "/", "/page", "/section/page/"])
      expectForwarded(`/${family}${rest}`);
  for (const file of legacyFiles) expectForwarded(`/${file}`);
  return problems;
}

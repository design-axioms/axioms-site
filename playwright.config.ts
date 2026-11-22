import { defineConfig } from "@playwright/test";

const hostedURL = process.env.AXIOMS_SITE_URL;
const previewURL = "http://127.0.0.1:8176";
const routeTest = "routes.spec.ts";

export default defineConfig({
  testDir: "./browser",
  use: {
    baseURL: hostedURL || previewURL,
    viewport: { width: 1280, height: 900 },
  },
  projects: [
    { name: "routes", testMatch: routeTest },
    ...(["chromium", "firefox", "webkit"] as const).map((browserName) => ({
      name: browserName,
      testIgnore: routeTest,
      use: { browserName },
    })),
  ],
  ...(hostedURL
    ? {}
    : {
        webServer: {
          command: "node scripts/serve.ts --port 8176 --once",
          url: previewURL,
        },
      }),
});

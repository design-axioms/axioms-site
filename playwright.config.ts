import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser",
  use: {
    baseURL: "http://127.0.0.1:8176",
    viewport: { width: 1280, height: 900 },
  },
  projects: (["chromium", "firefox", "webkit"] as const).map((browserName) => ({
    name: browserName,
    use: { browserName },
  })),
  webServer: {
    command: "node scripts/serve.ts --port 8176 --once",
    url: "http://127.0.0.1:8176",
  },
});

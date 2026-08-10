import vinext from "vinext";
import { defineConfig, type Plugin } from "vite";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

function localPreviewMedia(): Plugin {
  const previewRoot = path.resolve("storage/previews");
  return {
    name: "local-preview-media",
    enforce: "pre" as const,
    configureServer(server) {
      server.middlewares.use("/media/previews/v1", (request, response, next) => {
        try {
          const relative = decodeURIComponent((request.url ?? "").split("?", 1)[0]).replace(/^\/+/, "");
          if (!/^\d{3}\/\d+\/poster$/.test(relative)) return next();
          const filePath = path.resolve(previewRoot, relative);
          if (!filePath.startsWith(`${previewRoot}${path.sep}`) || !statSync(filePath).isFile()) return next();
          response.statusCode = 200;
          response.setHeader("content-type", "image/webp");
          response.setHeader("cache-control", "no-cache");
          createReadStream(filePath).pipe(response);
        } catch {
          next();
        }
      });
    },
  };
}

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      localPreviewMedia(),
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});

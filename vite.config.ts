import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

import { defineConfig, type Plugin } from "vite";

import { BG_COLOR } from "./src/config";
import { hexColor, ICON_FILES, MANIFEST_FILE, renderIcon, webManifest } from "./src/icon";
import { encodePng } from "./src/png";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8"),
) as { version: string };

// The repo ships no image files, so the app icons and the web manifest are
// rendered from code when the bundle is built (and on request in dev).
function appIcons(): Plugin {
  const files = new Map<string, () => { type: string; body: Uint8Array }>();
  for (const icon of ICON_FILES) {
    files.set(icon.file, () => ({
      type: "image/png",
      body: encodePng(icon.size, icon.size, renderIcon(icon.size, icon.rounded), (raw) => deflateSync(raw, { level: 9 })),
    }));
  }
  files.set(MANIFEST_FILE, () => ({
    type: "application/manifest+json",
    body: new TextEncoder().encode(JSON.stringify(webManifest(), null, 2)),
  }));

  return {
    name: "starball-app-icons",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = (req.url ?? "").split("?")[0].split("/").pop() ?? "";
        const make = files.get(name);
        if (!make) return next();
        const { type, body } = make();
        res.setHeader("Content-Type", type);
        res.end(Buffer.from(body));
      });
    },
    generateBundle() {
      for (const [fileName, make] of files) {
        this.emitFile({ type: "asset", fileName, source: make().body });
      }
    },
    transformIndexHtml: {
      order: "post",
      handler: () => [
        { tag: "link", attrs: { rel: "icon", type: "image/png", sizes: "192x192", href: "icon-192.png" }, injectTo: "head" },
        { tag: "link", attrs: { rel: "apple-touch-icon", sizes: "180x180", href: "apple-touch-icon.png" }, injectTo: "head" },
        { tag: "link", attrs: { rel: "manifest", href: MANIFEST_FILE }, injectTo: "head" },
        { tag: "meta", attrs: { name: "theme-color", content: hexColor(BG_COLOR) }, injectTo: "head" },
      ],
    },
  };
}

export default defineConfig({
  plugins: [appIcons()],
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});

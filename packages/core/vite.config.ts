import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The design system's stylesheet references vendor images (logo, mascot, banners, avatars). Our legal policy
// (skills/add-crm/docs/legal-and-sources.md) allows its CSS only, and this package is redistributed on npm, so
// every image reference is removed before Vite resolves it: no vendor image ends up in dist/web.
const stripVendorImages = {
  postcssPlugin: "strip-vendor-images",
  Declaration(decl: { value: string; remove: () => void }) {
    if (/url\(\s*['"]?(?!#)/.test(decl.value)) decl.remove();
  },
  AtRule: { "font-face": (rule: { remove: () => void }) => rule.remove() },
};

// Vite still emits the files it saw referenced; drop them (our own icons are inline SVG, so nothing else is lost).
const dropVendorFiles = {
  name: "drop-vendor-files",
  generateBundle(_: unknown, bundle: Record<string, unknown>) {
    for (const file of Object.keys(bundle)) if (/\.(png|jpe?g|gif|svg|webp|woff2?|ttf|eot)$/.test(file)) delete bundle[file];
  },
};

// Builds the prebuilt UI into dist/web; projects serve it as Workers static assets.
export default defineConfig({
  plugins: [react(), dropVendorFiles],
  css: { postcss: { plugins: [stripVendorImages] } },
  build: { outDir: "dist/web", emptyOutDir: true },
  server: { proxy: { "/api": "http://localhost:8787" } },
  test: { include: ["src/**/*.test.ts"] },
} as any);

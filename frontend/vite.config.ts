import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const config = defineConfig({
  // In this pnpm workspace, react/react-dom can resolve to two physical copies
  // (root vs. frontend node_modules). That gives the SSR render a null hook
  // dispatcher when a dep like @tanstack/react-store grabs the other copy.
  // Deduping forces a single React instance for both client and SSR.
  resolve: { tsconfigPaths: true, dedupe: ["react", "react-dom"] },
  ssr: { noExternal: ["@tanstack/react-store", "@tanstack/store"] },
  // Allow serving files from the workspace root: in this pnpm monorepo some deps
  // (e.g. @fontsource-variable/inter's .woff2) are hoisted to the root
  // node_modules, which is outside the frontend project root Vite serves by default.
  server: { fs: { allow: [".."] } },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart({ spa: { enabled: true } }),
    viteReact(),
  ],
})

export default config

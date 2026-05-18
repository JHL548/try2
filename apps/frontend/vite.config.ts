import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const localPackageAliases = [
  {
    find: /^@jhl548\/duplicate-doc-vue$/,
    replacement: resolve(__dirname, "../../packages/vue/src/index.ts")
  },
  {
    find: /^@jhl548\/duplicate-doc-vue\/style\.css$/,
    replacement: resolve(__dirname, "../../packages/vue/src/style.css")
  },
  {
    find: /^@jhl548\/duplicate-doc-core$/,
    replacement: resolve(__dirname, "../../packages/core/src/index.ts")
  },
  {
    find: /^@jhl548\/duplicate-doc-core\/style\.css$/,
    replacement: resolve(__dirname, "../../packages/core/src/style.css")
  }
];

const npmPackageAliases = [
  {
    find: /^@jhl548\/duplicate-doc-vue$/,
    replacement: resolve(__dirname, "../../.npm-verify/node_modules/@jhl548/duplicate-doc-vue/dist/index.js")
  },
  {
    find: /^@jhl548\/duplicate-doc-vue\/style\.css$/,
    replacement: resolve(__dirname, "../../.npm-verify/node_modules/@jhl548/duplicate-doc-vue/src/style.css")
  },
  {
    find: /^@jhl548\/duplicate-doc-core$/,
    replacement: resolve(__dirname, "../../.npm-verify/node_modules/@jhl548/duplicate-doc-core/dist/index.js")
  },
  {
    find: /^@jhl548\/duplicate-doc-core\/style\.css$/,
    replacement: resolve(__dirname, "../../.npm-verify/node_modules/@jhl548/duplicate-doc-core/src/style.css")
  }
];

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  resolve: {
    alias: mode === "npm" ? npmPackageAliases : localPackageAliases,
    dedupe: ["vue"]
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000"
    }
  }
}));

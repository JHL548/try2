import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    vue(),
    dts({
      insertTypesEntry: true,
      entryRoot: "src",
      pathsToAliases: false,
      aliasesExclude: [/^@jhl548\/duplicate-doc-core$/]
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "DuplicateDocVue",
      fileName: "index",
      formats: ["es"]
    },
    rollupOptions: {
      external: [
        "vue",
        "@jhl548/duplicate-doc-core",
        "@tiptap/vue-3",
        "@tiptap/starter-kit",
        "@tiptap/extension-color",
        "@tiptap/extension-highlight",
        "@tiptap/extension-image",
        "@tiptap/extension-subscript",
        "@tiptap/extension-superscript",
        "@tiptap/extension-table",
        "@tiptap/extension-table-cell",
        "@tiptap/extension-table-header",
        "@tiptap/extension-table-row",
        "@tiptap/extension-task-item",
        "@tiptap/extension-task-list",
        "@tiptap/extension-text-align",
        "@tiptap/extension-text-style"
      ]
    }
  }
});

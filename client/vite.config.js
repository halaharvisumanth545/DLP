import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        app: resolve(__dirname, "index.html"),
        materialGenerationFlow: resolve(__dirname, "material-generation-flow.html"),
        questionGenerationFlow: resolve(__dirname, "question-generation-flow.html"),
        questionDiagramExport: resolve(__dirname, "question-diagram-export.html"),
        processDocumentDiagrams: resolve(__dirname, "process-document-diagrams.html"),
      },
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// `vite build --mode artifact` produces one self-contained bundle (see scripts/make-artifact.mjs).
export default defineConfig(({ mode }) => {
  const artifact = mode === "artifact";
  const pages = mode === "pages";
  return {
    base: artifact || pages ? "./" : "/",
    server: { host: "::", port: 8080 },
    plugins: [react()],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    define: artifact
      ? { "import.meta.env.VITE_ROUTER": JSON.stringify("memory") }
      : pages
        ? { "import.meta.env.VITE_ROUTER": JSON.stringify("hash") }
        : {},
    build: artifact
      ? { outDir: "dist-artifact", cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } }
      : pages
        ? { outDir: "dist-pages" }
        : {},
  };
});

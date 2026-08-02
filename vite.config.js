import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: false },
  // cubing.js ships its random-state solvers as code-split ES module workers.
  worker: { format: "es" },
  optimizeDeps: { exclude: ["cubing"] },
  build: { target: "es2022" },
});

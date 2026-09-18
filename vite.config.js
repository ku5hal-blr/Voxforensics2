import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    allowedHosts: ["3000-ikktonoael5hf79q8gp9w.e2b.app"],
    hmr: {
      port: 3000,
    },
  },
});

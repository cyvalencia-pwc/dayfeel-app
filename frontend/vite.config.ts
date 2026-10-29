import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwind()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api/identity": {
        target: "http://127.0.0.1:8081",
        rewrite: (p) => p.replace(/^\/api\/identity/, ""),
      },
      "/api/content": {
        target: "http://127.0.0.1:8082",
        rewrite: (p) => p.replace(/^\/api\/content/, ""),
      },
      "/socket.io": { target: "http://127.0.0.1:8082", ws: true },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});

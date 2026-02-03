import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow network access
    port: 5173,
    allowedHosts: [
      'yuk-nonpedagogic-pridelessly.ngrok-free.dev',
      '.ngrok-free.dev', // Allow all ngrok subdomains
      '.ngrok.io', // Allow old ngrok domains
    ],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./vitest.setup.js",
  },
});

// vite.config.ts (no change needed)
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/chat": "http://localhost:4000",
      "/connect-qbo": "http://localhost:4000",
      "/qbo-status": "http://localhost:4000"
    }
  }
});

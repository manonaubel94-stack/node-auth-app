import { defineConfig } from "vite";

// In dev (npm run dev), forward /api to a backend running on port 3000.
export default defineConfig({
  server: {
    proxy: { "/api": "http://localhost:3000" },
  },
});

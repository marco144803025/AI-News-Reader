import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: '/AI-News-Reader/',
  plugins: [react(), tailwindcss()],
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/party-bet-arena/",
  plugins: [react()],
});

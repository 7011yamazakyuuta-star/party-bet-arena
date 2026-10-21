import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/party-bet-arena/",
  plugins: [
    react(),
    {
      name: "local-emulator-csp",
      apply: "serve",
      transformIndexHtml(html) {
        return html.replace(
          "connect-src 'self' ",
          "connect-src 'self' http://127.0.0.1:9000 http://127.0.0.1:9099 ws://127.0.0.1:9000 "
        );
      },
    },
  ],
});

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const botToken =
    env.VITE_BOT_TOKEN || env.BOT_TOKEN || process.env.VITE_BOT_TOKEN || process.env.BOT_TOKEN || "";

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_BOT_TOKEN": JSON.stringify(botToken),
    },
    server: { port: 3001 },
  };
});

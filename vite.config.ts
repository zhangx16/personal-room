import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
export default defineConfig(({mode}) => {
  const env=loadEnv(mode,process.cwd(),"");
  return {
  plugins: [react()], resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { proxy: { "/api": env.VITE_API_PROXY || `http://127.0.0.1:${env.PORT || 22836}` } },
  };
});

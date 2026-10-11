import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" => los archivos se cargan con rutas relativas y la app funciona
// tanto en https://usuario.github.io/repositorio/ como en un dominio propio.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", sourcemap: false },
});

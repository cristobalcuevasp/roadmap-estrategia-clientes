/* Ejecuta las pruebas de la lógica del módulo CRM.
   Usa esbuild para resolver las importaciones sin extensión (igual que Vite). Uso: node tests/run.mjs */
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
let esbuild;
for (const base of [here, "/opt/npm-tools/"]) {
  try { esbuild = require(require.resolve("esbuild", { paths: [base] })); break; } catch (e) { /* siguiente ubicación */ }
}
if (!esbuild) { console.error("No se encontró esbuild. Ejecuta `npm install` (vite lo trae como dependencia)."); process.exit(2); }

const files = readdirSync(here).filter((f) => f.endsWith(".test.js")).map((f) => join(here, f));
const out = mkdtempSync(join(tmpdir(), "crm-tests-"));
await esbuild.build({ entryPoints: files, bundle: true, platform: "node", format: "esm", outdir: out, outExtension: { ".js": ".mjs" }, logLevel: "error" });
const built = readdirSync(out).filter((f) => f.endsWith(".mjs")).map((f) => join(out, f));
const r = spawnSync(process.execPath, ["--test", ...built], { stdio: "inherit" });
rmSync(out, { recursive: true, force: true });
process.exit(r.status ?? 1);

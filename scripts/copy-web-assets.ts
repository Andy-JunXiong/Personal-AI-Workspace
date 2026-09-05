import { copyFileSync, mkdirSync } from "node:fs";
// Source path is relative to the emitted build script, independent of cwd.
mkdirSync(new URL("../src/web/assets/", import.meta.url), { recursive: true });
for (const name of ["workspace.css", "workspace.js"]) {
  copyFileSync(new URL(`../../src/web/assets/${name}`, import.meta.url), new URL(`../src/web/assets/${name}`, import.meta.url));
}

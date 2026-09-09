import { copyFileSync, mkdirSync } from "node:fs";
// Source path is relative to the emitted build script, independent of cwd.
mkdirSync(new URL("../src/web/assets/", import.meta.url), { recursive: true });
for (const name of ["workspace.css", "workspace.js", "job-library.js", "resume.js", "resume.css"]) {
  copyFileSync(new URL(`../../src/web/assets/${name}`, import.meta.url), new URL(`../src/web/assets/${name}`, import.meta.url));
}

for (const name of ["resume-template.py", "resume-word-pdf.ps1"]) copyFileSync(new URL(`../../scripts/${name}`, import.meta.url), new URL(`./${name}`, import.meta.url));

import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { checkWebRelease, type WebWriteExpectation } from "../src/operations/web-release-check.js";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      origin: { type: "string" },
      writes: { type: "string", default: "off" },
      timeout: { type: "string", default: "10000" },
    },
    strict: true,
    allowPositionals: false,
  });
  if (!values.origin || !["off", "on"].includes(values.writes ?? "")) {
    throw new Error("Usage: npm run web:check -- --origin https://host --writes off|on");
  }
  if (!/^\d+$/u.test(values.timeout ?? "")) throw new Error("Timeout must be milliseconds");
  const report = await checkWebRelease({ origin: values.origin,
    expectedWrites: values.writes as WebWriteExpectation, timeoutMs: Number(values.timeout) });
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main().catch((error: unknown) => {
    console.error(JSON.stringify({ passed: false,
      error: error instanceof Error ? error.message : "Web release check failed" }));
    process.exitCode = 1;
  });
}

import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const databasePath = process.argv[2]?.trim();
if (!databasePath) {
  console.error("Usage: node database-logical-fingerprint.mjs <database-path>");
  process.exit(1);
}

const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
const hash = createHash("sha256");
const frame = (value) => {
  const bytes = Buffer.from(value, "utf8");
  hash.update(String(bytes.length));
  hash.update(":");
  hash.update(bytes);
};

const database = new Database(resolve(databasePath), {
  readonly: true,
  fileMustExist: true,
});

let rowCount = 0;
try {
  database.pragma("query_only = ON");
  const tables = database.prepare(
    `SELECT name, sql FROM sqlite_schema
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
     ORDER BY name`,
  ).all();

  for (const table of tables) {
    frame(table.name);
    frame(table.sql ?? "");
    const columns = database.prepare(
      `PRAGMA table_info(${quoteIdentifier(table.name)})`,
    ).all();
    frame(JSON.stringify(columns));
    const order = columns.map((column) => quoteIdentifier(column.name)).join(", ");
    const rows = database.prepare(
      `SELECT * FROM ${quoteIdentifier(table.name)}${order ? ` ORDER BY ${order}` : ""}`,
    ).iterate();
    for (const row of rows) {
      frame(JSON.stringify(row));
      rowCount += 1;
    }
  }

  console.log(`${hash.digest("hex")}\t${tables.length}\t${rowCount}`);
} finally {
  database.close();
}
